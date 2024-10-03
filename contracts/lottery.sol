// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MultiTokenLottery is Ownable(msg.sender) {
    struct Winner {
        address winnerAddress;
        uint256 round;
    }

    struct Lottery {
        address tokenAddress;
        uint256 ticketPrice;
        uint256 roundEndTime;
        uint256 roundDuration;
        address[] participants; // Array of participants
        address lastWinner;
        uint256 prizePool;
        uint256 totalBurned; // Total burned tokens for this lottery
        uint256 buyFeePool; // Accumulated 50% of buyFee for this lottery round
        address reserveReceiver; // Custom reserve fund receiver for this lottery
    }

    address[] lotteryTokens;
    mapping(address => mapping(uint256 => Lottery)) public lotteries; // Supports multiple lotteries for each token
    mapping(address => uint256) public lotteryCount; // Track the number of lotteries for each token

    address public reserveFund; // The main reserve fund set by the contract owner
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

        uint256 currentLotteryId = lotteryCount[tokenAddress]++;
        Lottery storage lottery = lotteries[tokenAddress][currentLotteryId];

        lottery.tokenAddress = tokenAddress;
        lottery.ticketPrice = ticketPrice;
        lottery.roundEndTime = block.timestamp + duration;
        lottery.roundDuration = duration;

        // Set custom reserve fund receiver for this lottery
        lottery.reserveReceiver = _reserveReceiver != address(0)
            ? _reserveReceiver
            : reserveFund;

        // Add tokenAddress to lotteryTokens if it's a new token
        if (lotteryCount[tokenAddress] == 1) {
            lotteryTokens.push(tokenAddress);
        }

        // Transfer the creation fee to the main reserve fund
        (bool success, ) = reserveFund.call{value: msg.value}("");
        require(success, "Failed to transfer creation fee to reserve fund");
    }

    function buyTickets(
        address tokenAddress,
        uint256 lotteryId,
        uint256 quantity
    ) external payable {
        require(quantity > 0, "Must buy at least one ticket");
        require(msg.value >= buyFee, "Insufficient buy fee");

        Lottery storage lottery = lotteries[tokenAddress][lotteryId];
        require(block.timestamp < lottery.roundEndTime, "Lottery round ended");

        uint256 totalCost = lottery.ticketPrice * quantity;
        require(totalCost >= lottery.ticketPrice, "Cost calculation overflow");
        require(
            IERC20(tokenAddress).allowance(msg.sender, address(this)) >=
                totalCost,
            "Insufficient allowance"
        );
        require(
            IERC20(tokenAddress).balanceOf(msg.sender) >= totalCost,
            "Insufficient balance"
        );

        require(
            IERC20(tokenAddress).transferFrom(
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

        address nullAddress = 0x0000000000000000000000000000000000000000;
        address deadAddress = 0x000000000000000000000000000000000000dEaD;

        try IERC20(tokenAddress).transfer(nullAddress, burnShare) {
            // Do nothing
        } catch {
            IERC20(tokenAddress).transfer(deadAddress, burnShare);
        }

        // Transfer reserve share to custom reserveReceiver
        IERC20(tokenAddress).transfer(lottery.reserveReceiver, reserveShare);

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

    function drawWinner(address tokenAddress, uint lotteryId) external {
        Lottery storage lottery = lotteries[tokenAddress][lotteryId];

        require(block.timestamp >= lottery.roundEndTime, "Round not yet ended");
        require(lottery.participants.length > 0, "No participants");

        uint256 winnerIndex = random(tokenAddress, lotteryId) %
            lottery.participants.length;
        address winner = lottery.participants[winnerIndex];

        uint256 tokenPrize = lottery.prizePool;

        // Transfer the prize pool (ERC20 tokens) to the winner
        require(
            IERC20(tokenAddress).transfer(winner, tokenPrize),
            "Transfer to winner failed"
        );

        lottery.lastWinner = winner;
    }

    function random(
        address tokenAddress,
        uint lotteryId
    ) private view returns (uint256 index) {
        Lottery storage lottery = lotteries[tokenAddress][lotteryId];
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

    function getLotteryData(
        address _tokenAddress,
        uint256 lotteryId
    )
        external
        view
        returns (
            address tokenAddress,
            uint256 ticketPrice,
            uint256 roundEndTime,
            uint256 roundDuration,
            address[] memory participants,
            address lastWinner,
            uint256 prizePool,
            uint256 totalBurned,
            uint256 buyFeePool,
            address reserveReceiver
        )
    {
        Lottery storage lottery = lotteries[_tokenAddress][lotteryId];

        return (
            lottery.tokenAddress,
            lottery.ticketPrice,
            lottery.roundEndTime,
            lottery.roundDuration,
            lottery.participants,
            lottery.lastWinner,
            lottery.prizePool,
            lottery.totalBurned,
            lottery.buyFeePool,
            lottery.reserveReceiver
        );
    }

    // Getter functions
    function getParticipants(
        address tokenAddress,
        uint lotteryId
    ) external view returns (address[] memory) {
        return lotteries[tokenAddress][lotteryId].participants;
    }

    function getTimeLeft(
        address tokenAddress,
        uint lotteryId
    ) external view returns (uint256) {
        Lottery storage lottery = lotteries[tokenAddress][lotteryId];
        if (block.timestamp >= lottery.roundEndTime) return 0;
        return lottery.roundEndTime - block.timestamp;
    }

    function getTotalTickets(
        address tokenAddress,
        uint lotteryId
    ) external view returns (uint256) {
        return lotteries[tokenAddress][lotteryId].participants.length;
    }

    function getTotalBurned(
        address tokenAddress,
        uint lotteryId
    ) external view returns (uint256) {
        return lotteries[tokenAddress][lotteryId].totalBurned;
    }

    function getLastWinner(
        address tokenAddress,
        uint lotteryId
    ) external view returns (address) {
        return lotteries[tokenAddress][lotteryId].lastWinner;
    }
}
