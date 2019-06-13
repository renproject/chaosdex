pragma solidity 0.5.8;

import "darknode-sol/contracts/RenShift/ERC20Shifted.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";

contract TestToken is ERC20, ERC20Detailed {
    constructor(string memory _name, string memory _symbol, uint8 _decimals)  public ERC20Detailed(_name, _symbol, _decimals) {
        _mint(msg.sender, 1000000000000000000000000000);
    }
}

contract RenToken is TestToken("Republic Token", "REN", 18) {}
contract DaiToken is TestToken("MakerDAO", "DAI", 18) {}
/* solium-disable-next-line no-empty-blocks */
contract zBTC is ERC20Shifted("Shifted BTC", "zBTC", 8) {}

/* solium-disable-next-line no-empty-blocks */
contract zZEC is ERC20Shifted("Shifted ZEC", "zZEC", 8) {}
