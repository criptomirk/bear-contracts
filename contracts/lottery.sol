// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MultiTokenLottery is Ownable(msg.sender) {
    struct Lottery {
        address tokenAddress;
        string tokenSymbol;
        uint256 ticketPrice;
        uint256 roundEndTime;
        uint256 roundDuration;
        address[] participants; // Array of participants
        address lastWinner;
        uint256 prizePool;
        uint256 totalBurned; // Total burned tokens for this lottery
        uint256 buyFeePool; // Accumulated 50% of buyFee for this lottery round
        address reserveReceiver; // Custom reserve fund receiver for this lottery
        bool isActive; // Flag to track if the lottery is active or ended
    }

    uint256 public lotteryCounter; // Incremental ID for all lotteries
    address[] public lotteryTokens; // Track tokens that have associated lotteries
    mapping(uint256 => Lottery) public lotteries; // Mapping for lotteryId => Lottery
    mapping(address => uint256[]) public lotteriesByCreator; // Track lotteries created by each address
    mapping(address => uint256[]) public lotteriesByTokenAddress; // Track lotteries by token address
    mapping(string => uint256[]) public lotteriesByTokenSymbol; // Track lotteries by token symbol
    uint256[] public allLotteries; // Optional: Array to track all lotteries created

    address public reserveFund; // Main reserve fund set by the contract owner
    uint256 public creationFee = 200_000 ether; // Creation fee as a constant
    uint256 public constant buyFee = 10_000 ether; // Buy fee as a constant

    constructor(address _reserveFund) {
        require(_reserveFund != address(0), "Invalid reserve fund address");
        reserveFund = _reserveFund;
    }

    // Only the owner can set the main reserve fund
    function setReserveFund(address _reserveFund) external onlyOwner {
        require(_reserveFund != address(0), "Invalid reserve fund address");
        reserveFund = _reserveFund;
    }

    // Function to set the creation fee (only callable by the owner)
    function setCreationFee(uint256 _newCreationFee) external onlyOwner {
        require(_newCreationFee > 0, "Creation fee must be greater than zero");
        creationFee = _newCreationFee;
    }

    function createLottery(
        address tokenAddress,
        uint256 duration,
        uint256 ticketPrice,
        address _reserveReceiver
    ) external payable {
        // Ensure the creation fee is paid
        if (msg.sender != owner()) {
            require(msg.value >= creationFee, "Insufficient creation fee");
        }

        // Fetch the token symbol using IERC20 interface
        string memory tokenSymbol = IERC20(tokenAddress).symbol();

        uint256 lotteryId = lotteryCounter++; // Increment lottery ID for new lottery
        Lottery storage lottery = lotteries[lotteryId];

        lottery.tokenAddress = tokenAddress;
        lottery.tokenSymbol = tokenSymbol;
        lottery.ticketPrice = ticketPrice;
        lottery.roundEndTime = block.timestamp + duration;
        lottery.roundDuration = duration;
        lottery.isActive = true; // Mark the lottery as active

        // Set custom reserve fund receiver for this lottery or default to main reserve
        lottery.reserveReceiver = _reserveReceiver != address(0)
            ? _reserveReceiver
            : reserveFund;

        // Add tokenAddress to lotteryTokens if this is the first lottery for the token
        if (lotteriesByTokenAddress[tokenAddress].length == 0) {
            lotteryTokens.push(tokenAddress);
        }

        // Push lotteryId to the list of lotteries created by the sender,
        // and lotteryId to the global list for easy retrieval.
        lotteriesByCreator[msg.sender].push(lotteryId);
        lotteriesByTokenAddress[tokenAddress].push(lotteryId);
        lotteriesByTokenSymbol[tokenSymbol].push(lotteryId);
        allLotteries.push(lotteryId);

        // Transfer the creation fee to the main reserve fund
        (bool success, ) = reserveFund.call{value: msg.value}("");
        require(success, "Failed to transfer creation fee to reserve fund");
    }

    function buyTickets(uint256 lotteryId, uint256 quantity) external payable {
        require(quantity > 0, "Must buy at least one ticket");
        require(msg.value >= buyFee, "Insufficient buy fee");

        Lottery storage lottery = lotteries[lotteryId];
        require(block.timestamp < lottery.roundEndTime, "Lottery round ended");
        require(lottery.isActive, "Lottery is not active");

        uint256 totalCost = lottery.ticketPrice * quantity;
        require(totalCost >= lottery.ticketPrice, "Cost calculation overflow");
        require(
            IERC20(lottery.tokenAddress).allowance(msg.sender, address(this)) >=
                totalCost,
            "Insufficient allowance"
        );
        require(
            IERC20(lottery.tokenAddress).balanceOf(msg.sender) >= totalCost,
            "Insufficient balance"
        );

        require(
            IERC20(lottery.tokenAddress).transferFrom(
                msg.sender,
                address(this),
                totalCost
            ),
            "Ticket purchase failed"
        );

        // 40% to pool, 40% to burn, 20% to reserveReceiver, buyFee goes to main reserve fund
        uint256 poolShare = (totalCost * 40) / 100;
        uint256 burnShare = (totalCost * 40) / 100;
        uint256 reserveShare = (totalCost * 20) / 100;

        lottery.prizePool += poolShare;
        lottery.totalBurned += burnShare;
        lottery.buyFeePool += buyFee;

        address deadAddress = 0x000000000000000000000000000000000000dEaD;

        try IERC20(lottery.tokenAddress).transfer(deadAddress, burnShare) {
            // Burn tokens
        } catch {
            revert("Burn failed");
        }

        // Transfer reserve share to custom reserveReceiver
        IERC20(lottery.tokenAddress).transfer(
            lottery.reserveReceiver,
            reserveShare
        );

        // Transfer the buyFee to the main reserve fund
        (bool sentToMainReserve, ) = reserveFund.call{value: buyFee}("");
        require(
            sentToMainReserve,
            "Failed to transfer buyFee to main reserve fund"
        );

        for (uint256 i = 0; i < quantity; i++) {
            lottery.participants.push(msg.sender);
        }
    }

    function drawWinner(uint256 lotteryId) external {
        Lottery storage lottery = lotteries[lotteryId];

        require(block.timestamp >= lottery.roundEndTime, "Round not yet ended");
        require(lottery.participants.length > 0, "No participants");

        uint256 winnerIndex = random(lotteryId) % lottery.participants.length;
        address winner = lottery.participants[winnerIndex];

        uint256 tokenPrize = lottery.prizePool;

        // Transfer the prize pool (ERC20 tokens) to the winner
        require(
            IERC20(lottery.tokenAddress).transfer(winner, tokenPrize),
            "Transfer to winner failed"
        );

        lottery.lastWinner = winner;
        lottery.isActive = false; // Mark the lottery as ended
    }

    function random(uint256 lotteryId) private view returns (uint256) {
        Lottery storage lottery = lotteries[lotteryId];
        return
            uint256(
                keccak256(
                    abi.encodePacked(
                        block.prevrandao,
                        block.timestamp,
                        lottery.participants
                    )
                )
            );
    }

    // Getter functions
    function getParticipants(
        uint256 lotteryId
    ) external view returns (address[] memory) {
        return lotteries[lotteryId].participants;
    }

    function getLotteryData(
        uint256 lotteryId
    )
        external
        view
        returns (
            address tokenAddress,
            string memory tokenSymbol,
            uint256 ticketPrice,
            uint256 roundEndTime,
            uint256 roundDuration,
            address[] memory participants,
            address lastWinner,
            uint256 prizePool,
            uint256 totalBurned,
            uint256 buyFeePool,
            address reserveReceiver,
            bool isActive // Return the lottery's active status
        )
    {
        Lottery storage lottery = lotteries[lotteryId];

        return (
            lottery.tokenAddress,
            lottery.tokenSymbol,
            lottery.ticketPrice,
            lottery.roundEndTime,
            lottery.roundDuration,
            lottery.participants,
            lottery.lastWinner,
            lottery.prizePool,
            lottery.totalBurned,
            lottery.buyFeePool,
            lottery.reserveReceiver,
            lottery.isActive // Include the active status
        );
    }

    // Get all lotteries created by an address
    function getLotteriesByCreator(
        address creator
    ) external view returns (uint256[] memory) {
        return lotteriesByCreator[creator];
    }

    // Get lotteries by token address
    function getLotteriesByTokenAddress(
        address tokenAddress
    ) external view returns (uint256[] memory) {
        return lotteriesByTokenAddress[tokenAddress];
    }

    // Get lotteries by token symbol
    function getLotteriesByTokenSymbol(
        string memory tokenSymbol
    ) external view returns (uint256[] memory) {
        return lotteriesByTokenSymbol[tokenSymbol];
    }

    // Optional: Get all lotteries
    function getAllLotteries() external view returns (uint256[] memory) {
        return allLotteries;
    }

    // Function to get the list of tracked lottery tokens
    function getLotteryTokens() external view returns (address[] memory) {
        return lotteryTokens;
    }
}
