pragma solidity 0.5.8;

import "darknode-sol/contracts/RenShift/RenShift.sol";
import "darknode-sol/contracts/RenShift/ERC20Shifted.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract RenExReserve is Ownable {
    RenShift public renshift;
    ERC20 public ethereum = ERC20(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee);
    mapping (address=>uint256) public approvals;

    constructor(RenShift _renshift) public {
        renshift = _renshift;
    }

    // solhint-disable-next-line no-empty-blocks
    function() external payable {
    }

    function approve(ERC20 _token, address spender, uint256 value) external onlyOwner {
        if (_token == ethereum) {
            approvals[spender] += value;
        } else {
            _token.approve(spender, value);
        }
    }

    function updateRenShift(RenShift _renshift) external onlyOwner {
        renshift = _renshift;
    }

    function transfer(address payable _to, uint256 _value) external {
        require(approvals[msg.sender] >= _value, "insufficient approval amount");
        approvals[msg.sender] -= _value;
        _to.transfer(_value);
    }

    function withdraw(ERC20 _token, bytes calldata _to, uint256 _amount) external onlyOwner {
        if (_token == ethereum) {
            bytesToAddress(_to).transfer(_amount);
        } else {
            if (renshift.isShiftedToken(address(_token))) {
                renshift.shiftOut(ERC20Shifted(address(_token)), _to, _amount);
            } else {
                _token.transfer(bytesToAddress(_to), _amount);
            }
        }
    }

    function bytesToAddress(bytes memory _addr) internal pure returns (address payable) {
        address payable addr;  
        /* solhint-disable-next-line */ /* solium-disable-next-line */
        assembly {
            addr := mload(add(_addr, 20))
        } 
    }
}   