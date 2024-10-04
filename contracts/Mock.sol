// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyToken is ERC20 {
    uint256 public initialSupply;

    // Modify the constructor to accept name, symbol, and initial supply as parameters
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply
    ) ERC20(_name, _symbol) {
        // Set the total supply based on the provided initial supply
        initialSupply = _initialSupply * (10 ** decimals());

        // Mint the initial supply to the contract deployer
        _mint(msg.sender, initialSupply);
    }
}
