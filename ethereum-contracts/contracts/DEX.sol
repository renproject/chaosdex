pragma solidity ^0.5.0;

import "./DEXReserve.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

/// @title DEX
/// @notice The DEX contract stores the reserves for each token pair and
/// provides functions for interacting with them:
///   1) the view-function `calculateReceiveAmount` for calculating how much
///      the user will receive in exchange for their tokens
///   2) the function `trade` for executing a swap. If one of the tokens is the
///      base token, this will only talk to one reserve. If neither of the
///      tokens are, then the trade will settle across two reserves.
///
/// The DEX is ownable, allowing a DEX operator to register new reserves.
/// Once a reserve has been registered, it can't be updated.
contract DEX is Ownable {
    mapping (address=>DEXReserve) public reserves;
    address public baseToken;

    event LogTrade(address _src, address _dst, uint256 _sendAmount, uint256 _recvAmount);

    /// @param _baseToken The reserves must all have a common base token.
    constructor(address _baseToken) public {
        baseToken = _baseToken;
    }

    /// @notice Allow anyone to recover funds accidentally sent to the contract.
    function recoverTokens(address _token) external onlyOwner {
        ERC20(_token).transfer(msg.sender, ERC20(_token).balanceOf(address(this)));
    }

    /// @notice The DEX operator is able to register new reserves.
    /// @param _erc20 The token that can be traded against the base token.
    /// @param _reserve The address of the reserve contract. It must follow the
    ///        DEXReserve interface.
    function registerReserve(address _erc20, DEXReserve _reserve) external onlyOwner {
        require(reserves[_erc20] == DEXReserve(0x0), "token reserve already registered");
        reserves[_erc20] = _reserve;
    }

    /// @notice The main trade function to execute swaps.
    /// @param _to The address at which the DST tokens should be sent to.
    /// @param _src The address of the token being spent.
    /// @param _dst The address of the token being received.
    /// @param _sendAmount The amount of the source token being traded.
    function trade(address _to, address _src, address _dst, uint256 _sendAmount) public returns (uint256) {
        uint256 recvAmount;
        if (_src == baseToken) {
            require(reserves[_dst] != DEXReserve(0x0), "unsupported token");
            recvAmount = reserves[_dst].buy(_to, msg.sender, _sendAmount);
        } else if (_dst == baseToken) {
            require(reserves[_src] != DEXReserve(0x0), "unsupported token");
            recvAmount = reserves[_src].sell(_to, msg.sender, _sendAmount);
        } else {
            require(reserves[_src] != DEXReserve(0x0) && reserves[_dst] != DEXReserve(0x0), "unsupported token");
            uint256 intermediteAmount = reserves[_src].sell(address(this), msg.sender, _sendAmount);
            ERC20(baseToken).approve(address(reserves[_dst]), intermediteAmount);
            recvAmount = reserves[_dst].buy(_to, address(this), intermediteAmount);
        }
        emit LogTrade(_src, _dst, _sendAmount, recvAmount);
        return recvAmount;
    }

    /// @notice A read-only function to estimate the amount of DST tokens the
    /// trader would receive for the send amount.
    /// @param _src The address of the token being spent.
    /// @param _dst The address of the token being received.
    /// @param _sendAmount The amount of the source token being traded.
    function calculateReceiveAmount(address _src, address _dst, uint256 _sendAmount) public view returns (uint256) {
        if (_src == baseToken) {
            return reserves[_dst].calculateBuyRcvAmt(_sendAmount);
        }
        if (_dst == baseToken) {
            return reserves[_src].calculateSellRcvAmt(_sendAmount);
        }
        return reserves[_dst].calculateBuyRcvAmt(reserves[_src].calculateSellRcvAmt(_sendAmount));
    }
}