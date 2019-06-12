pragma solidity 0.5.8;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";

contract TestToken is ERC20, ERC20Detailed {
    constructor(string memory _name, string memory _symbol, uint8 _decimals)  public ERC20Detailed(_name, _symbol, _decimals) {
        _mint(msg.sender, 1000000000000000000000000000);
    }
}