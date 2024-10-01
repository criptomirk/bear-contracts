// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    function transfer(
        address recipient,
        uint256 amount
    ) external returns (bool);
}

contract MultiTokenLottery {
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
    address public nullAddress = 0x000000000000000000000000000000000000dEaD;

    constructor() {
        // Initialize lotteries for different tokens if necessary
    }

    function createLottery(
        address tokenAddress,
        uint256 duration,
        uint256 ticketPrice
    ) external {
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
    }

    function buyTickets(address tokenAddress, uint256 quantity) external {
        require(quantity > 0, "Must buy at least one ticket");
        Lottery storage lottery = lotteries[tokenAddress];

        require(block.timestamp < lottery.roundEndTime, "Lottery round ended");

        uint256 totalCost = lottery.ticketPrice * quantity;

        // Transfer total ticket price
        require(
            IERC20(tokenAddress).transferFrom(
                msg.sender,
                address(this),
                totalCost
            ),
            "Ticket purchase failed"
        );

        // 50% to pool, 50% to burn
        uint256 poolShare = totalCost / 2;
        lottery.prizePool += poolShare;
        lottery.totalBurned += poolShare; // Track total burned
        IERC20(tokenAddress).transfer(nullAddress, poolShare);

        // Add participants
        for (uint256 i = 0; i < quantity; i++) {
            lottery.participants.push(msg.sender);
        }
    }

    function drawWinner(address tokenAddress) external {
        Lottery storage lottery = lotteries[tokenAddress];

        require(block.timestamp >= lottery.roundEndTime, "Round not yet ended");
        require(lottery.participants.length > 0, "No participants");

        // Random winner
        uint256 winnerIndex = random(tokenAddress) %
            lottery.participants.length;
        address winner = lottery.participants[winnerIndex];

        // Transfer prize to winner
        IERC20(tokenAddress).transfer(winner, lottery.prizePool);

        // Update last winner
        lottery.lastWinner = winner;

        // Reset lottery
        delete lottery.participants; // Clear participants for next round
        lottery.prizePool = 0;
        lottery.roundEndTime = block.timestamp + lottery.roundDuration;
    }

    function random(address tokenAddress) private view returns (uint256) {
        Lottery storage lottery = lotteries[tokenAddress];
        return
            uint256(
                keccak256(
                    abi.encodePacked(
                        block.prevrandao, // Replaced block.difficulty with block.prevrandao
                        block.timestamp,
                        lottery.participants
                    )
                )
            );
    }

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
