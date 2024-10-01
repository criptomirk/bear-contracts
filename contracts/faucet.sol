// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFuckToken {
    function transfer(
        address recipient,
        uint256 amount
    ) external returns (bool);

    function balanceOf(address account) external view returns (uint256);
}

contract FuckFaucet {
    address public owner;
    address public fuckToken; // Address of FUCK token contract
    address public treasury = 0x508b63a2Cf7A8d67E9064A7E46f5a7efEaBcC609; // Treasury address to collect PLS

    uint256 public constant CLAIM_COST = 15000 * 10 ** 18; // 15,000 PLS in wei
    uint256 public constant CLAIM_AMOUNT = 100 * 10 ** 18; // 100 FUCK tokens
    uint256 public totalClaims;
    uint256 public totalCollected;

    event Claim(address indexed claimant, uint256 fuckTokens, uint256 plsPaid);
    event Withdrawal(uint256 amount, address indexed to);

    constructor(address _fuckToken) {
        owner = msg.sender;
        fuckToken = _fuckToken; // Address of FUCK token contract
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this function");
        _;
    }

    // Function to claim 100 FUCK tokens by paying 15,000 PLS
    function claim() public payable {
        require(
            msg.value == CLAIM_COST,
            "You must send exactly 15,000 PLS to claim"
        );

        // Check if the faucet has enough FUCK tokens to give
        uint256 fuckBalance = IFuckToken(fuckToken).balanceOf(address(this));
        require(
            fuckBalance >= CLAIM_AMOUNT,
            "Faucet does not have enough FUCK tokens"
        );

        // Transfer 100 FUCK tokens to the claimant
        bool success = IFuckToken(fuckToken).transfer(msg.sender, CLAIM_AMOUNT);
        require(success, "FUCK token transfer failed");

        // Send the collected PLS to the treasury
        (bool sent, ) = treasury.call{value: msg.value}("");
        require(sent, "Failed to send PLS to treasury");

        // Update totals
        totalClaims += 1;
        totalCollected += msg.value;

        emit Claim(msg.sender, CLAIM_AMOUNT, msg.value);
    }

    // New function to claim multiple FUCK tokens with bonus based on claim multiplier
    function claimMultiple(uint256 claimCount) public payable {
        require(claimCount > 0, "Claim count must be greater than 0");

        uint256 totalCost = CLAIM_COST * claimCount; // Total PLS required
        uint256 totalAmount = calculateClaimAmount(claimCount); // Calculate the total FUCK tokens to be claimed

        require(msg.value == totalCost, "Incorrect PLS amount sent");

        // Check if the faucet has enough FUCK tokens to give, including bonus
        uint256 fuckBalance = IFuckToken(fuckToken).balanceOf(address(this));
        require(
            fuckBalance >= totalAmount,
            "Faucet does not have enough FUCK tokens"
        );

        // Transfer the required FUCK tokens to the claimant
        bool success = IFuckToken(fuckToken).transfer(msg.sender, totalAmount);
        require(success, "FUCK token transfer failed");

        // Send the collected PLS to the treasury
        (bool sent, ) = treasury.call{value: msg.value}("");
        require(sent, "Failed to send PLS to treasury");

        // Update totals
        totalClaims += claimCount;
        totalCollected += msg.value;

        emit Claim(msg.sender, totalAmount, msg.value);
    }

    // Read function to calculate the total FUCK tokens a user will receive based on claim count and bonuses
    function calculateClaimAmount(
        uint256 claimCount
    ) public pure returns (uint256) {
        uint256 totalAmount = CLAIM_AMOUNT * claimCount; // Base total FUCK tokens to be claimed

        // Apply bonus based on claim multiplier ranges
        if (claimCount >= 10 && claimCount < 100) {
            totalAmount = (totalAmount * 110) / 100; // 10% more for claims between 10 and 99
        } else if (claimCount >= 100 && claimCount < 1000) {
            totalAmount = (totalAmount * 120) / 100; // 20% more for claims between 100 and 999
        } else if (claimCount >= 1000) {
            totalAmount = (totalAmount * 150) / 100; // 50% more for claims of 1000 or more
        }

        return totalAmount; // Return the calculated total amount including any bonuses
    }

    // Function to check the total number of claims
    function getTotalClaims() public view returns (uint256) {
        return totalClaims;
    }

    // Function to check the total amount of PLS collected
    function getTotalCollected() public view returns (uint256) {
        return totalCollected;
    }

    // Function to check the remaining FUCK tokens in the faucet
    function getRemainingFuckTokens() public view returns (uint256) {
        return IFuckToken(fuckToken).balanceOf(address(this));
    }

    // Function to withdraw remaining FUCK tokens (only owner can withdraw)
    function withdrawFuckTokens(uint256 amount) public onlyOwner {
        uint256 fuckBalance = IFuckToken(fuckToken).balanceOf(address(this));
        require(amount <= fuckBalance, "Insufficient FUCK tokens in faucet");

        bool success = IFuckToken(fuckToken).transfer(owner, amount);
        require(success, "FUCK token transfer failed");

        emit Withdrawal(amount, owner);
    }

    // Function to check the total PLS raised
    function getTotalPLSRaised() public view returns (uint256) {
        return address(this).balance;
    }

    // Fallback function to receive PLS
    receive() external payable {}
}
