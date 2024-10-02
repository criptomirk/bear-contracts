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
        address[] participants; // Define participants as an array of addresses
        address lastWinner;
        uint256 prizePool;
        uint256 totalBurned; // Total burned tokens for this lottery
    }

    mapping(address => Lottery) public lotteries;
    address public reserveFund;
    uint256 public creationFee; // Fee for creating a new lottery

    constructor(address _reserveFund, uint256 _creationFee) {
        require(_reserveFund != address(0), "Invalid reserve fund address");
        reserveFund = _reserveFund;
        creationFee = _creationFee;
    }

    // Only the owner can set the reserve fund
    function setReserveFund(address _reserveFund) external onlyOwner {
        require(_reserveFund != address(0), "Invalid reserve fund address");
        reserveFund = _reserveFund;
    }

    // Only the owner can set the lottery creation fee
    function setCreationFee(uint256 _creationFee) external onlyOwner {
        creationFee = _creationFee;
    }

    function createLottery(
        address tokenAddress,
        uint256 duration,
        uint256 ticketPrice
    ) external payable {
        // Ensure the creation fee is paid
        if (msg.sender != owner()) {
            require(msg.value >= creationFee, "Insufficient creation fee");
        }
        // Create a new lottery for the specified token
        require(
            lotteries[tokenAddress].tokenAddress == address(0),
            "Lottery already exists for this token"
        );

        Lottery storage lottery = lotteries[tokenAddress]; // Create a reference to the lottery

        lottery.tokenAddress = tokenAddress; // Set token address
        lottery.ticketPrice = ticketPrice; // Set ticket price from input
        lottery.roundEndTime = block.timestamp + duration; // Set end time for this round
        lottery.roundDuration = duration; // Set round duration

        // Transfer the creation fee to the reserve fund
        (bool success, ) = reserveFund.call{value: msg.value}("");
        require(success, "Failed to transfer creation fee to reserve fund");
    }

    function buyTickets(address tokenAddress, uint256 quantity) external {
        require(quantity > 0, "Must buy at least one ticket");
        Lottery storage lottery = lotteries[tokenAddress];

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

        // 40% to pool, 40% to burn, 20% to reserve fund
        uint256 poolShare = (totalCost * 40) / 100;
        uint256 burnShare = (totalCost * 40) / 100;
        uint256 reserveShare = (totalCost * 20) / 100;

        lottery.prizePool += poolShare;
        lottery.totalBurned += burnShare;

        // Define the null address and dead address locally
        address nullAddress = 0x0000000000000000000000000000000000000000;
        address deadAddress = 0x000000000000000000000000000000000000dEaD;

        // Try to send tokens to the null address
        try IERC20(tokenAddress).transfer(nullAddress, burnShare) {
            // If successful, do nothing further
        } catch {
            // If transfer to null address reverts, fallback to dead address
            IERC20(tokenAddress).transfer(deadAddress, burnShare);
        }

        // Transfer reserve share to reserve fund
        IERC20(tokenAddress).transfer(reserveFund, reserveShare);

        for (uint256 i = 0; i < quantity; i++) {
            lottery.participants.push(msg.sender);
        }
    }

    function drawWinner(address tokenAddress) external {
        Lottery storage lottery = lotteries[tokenAddress];

        require(block.timestamp >= lottery.roundEndTime, "Round not yet ended");
        require(lottery.participants.length > 0, "No participants");

        uint256 winnerIndex = random(tokenAddress) %
            lottery.participants.length;
        address winner = lottery.participants[winnerIndex];

        IERC20(tokenAddress).transfer(winner, lottery.prizePool);

        lottery.lastWinner = winner;

        delete lottery.participants;
        lottery.prizePool = 0;
        lottery.roundEndTime = block.timestamp + lottery.roundDuration;
    }

    function random(address tokenAddress) private view returns (uint256) {
        Lottery storage lottery = lotteries[tokenAddress];
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
        address tokenAddress
    ) external view returns (address[] memory) {
        return lotteries[tokenAddress].participants;
    }

    function getTimeLeft(address tokenAddress) external view returns (uint256) {
        Lottery storage lottery = lotteries[tokenAddress];
        if (block.timestamp >= lottery.roundEndTime) return 0;
        return lottery.roundEndTime - block.timestamp;
    }

    function getTotalTickets(
        address tokenAddress
    ) external view returns (uint256) {
        return lotteries[tokenAddress].participants.length;
    }

    function getTotalBurned(
        address tokenAddress
    ) external view returns (uint256) {
        return lotteries[tokenAddress].totalBurned;
    }

    function getLastWinner(
        address tokenAddress
    ) external view returns (address) {
        return lotteries[tokenAddress].lastWinner;
    }
}
