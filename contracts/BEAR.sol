// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title Interface for ERC20 standard
 */
interface IERC20 {
    // External view functions
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);

    // External functions
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    // Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

/**
 * @title FuckTheBears ERC20 token contract
 */
contract FuckTheBears is IERC20 {
    // Contract information
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 private constant _totalSupply = 69_000_000 * (10 ** uint256(decimals));
    uint256 private _totalBurned;
    uint256 public constant transferTaxPercentage = 69; // 0.69% tax
    address public constant ZeroDead = address(0xdead); // Set owner to the dead address
    address private _owner;
    address private _recipient;

    // State variables
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // Constructor to initialize the contract with name, symbol, and recipient
    constructor(string memory _tokenName, string memory _tokenSymbol, address recipient) {
        name = _tokenName;
        symbol = _tokenSymbol;
        _owner = ZeroDead;
        _recipient = recipient;
        _balances[recipient] = _totalSupply;
        emit Transfer(address(0), recipient, _totalSupply);
    }

    // External view functions

    /**
     * @dev Returns the total supply of tokens.
     */
    function totalSupply() external pure override returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev Returns the balance of the specified account.
     */
    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    /**
     * @dev Returns the allowance for a spender on behalf of an owner.
     */
    function allowance(address owner, address spender) external view override returns (uint256) {
        return _allowances[owner][spender];
    }

    // External functions

    /**
     * @dev Transfers tokens from sender to recipient with tax applied.
     */
    function transfer(address recipient, uint256 amount) external override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    /**
     * @dev Approves the spender to spend tokens on behalf of the sender.
     */
    function approve(address spender, uint256 amount) external override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    /**
     * @dev Transfers tokens from sender to recipient on behalf of owner.
     */
    function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(sender, msg.sender, _allowances[sender][msg.sender] - amount);
        return true;
    }

    // Internal functions

    /**
     * @dev Internal function to transfer tokens with tax applied.
     */
    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != ZeroDead, "Transfer from the zero address");
        require(recipient != ZeroDead, "Transfer to the zero address");

        uint256 taxAmount = amount * transferTaxPercentage / 10000;
        uint256 amountAfterTax = amount - taxAmount;

        _balances[sender] -= amount;
        _balances[recipient] += amountAfterTax;
        _balances[ZeroDead] += taxAmount; // Send tax to the dead address
        _totalBurned += taxAmount; // Update total burned amount

        emit Transfer(sender, recipient, amountAfterTax);
        emit Transfer(sender, ZeroDead, taxAmount);
    }

    /**
     * @dev Internal function to approve spender to spend tokens on behalf of owner.
     */
    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != ZeroDead, "Approve from the zero address");
        require(spender != ZeroDead, "Approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    // External view functions

    /**
     * @dev Returns the owner of the contract.
     */
    function getOwner() external view returns (address) {
        return _owner;
    }

    /**
     * @dev Returns the recipient wallet address.
     */
    function getRecipient() external view returns (address) {
        return _recipient;
    }

    /**
     * @dev Returns the total amount of tokens burned.
     */
    function totalBurned() external view returns (uint256) {
        return _totalBurned;
    }
}