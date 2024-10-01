// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyToken is ERC20 {
    // Define the initial supply as a state variable instead of a constant
    uint256 public initialSupply;

    constructor() ERC20("MyToken", "MTK") {
        // Set the total supply to 1 billion (1,000,000,000) tokens
        initialSupply = 1_000_000_000 * (10 ** decimals());

        _mint(msg.sender, initialSupply); // Mint the total supply to the contract deployer
    }
}
