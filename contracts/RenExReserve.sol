pragma solidity 0.5.8;

import "darknode-sol/contracts/RenShift/Shifter.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract RenExReserve is Ownable {
    ERC20 public ethereum = ERC20(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee);

    mapping (address => Shifter) public shifters;
    mapping (address => bool) public isShifted;
    mapping (address=>uint256) public approvals;

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

    function setShifter(ERC20 _token, Shifter _renshift) external onlyOwner {
        isShifted[address(_token)] = true;
        shifters[address(_token)] = _renshift;
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
            if (isShifted[address(_token)]) {
                shifters[address(_token)].shiftOut(_to, _amount);
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