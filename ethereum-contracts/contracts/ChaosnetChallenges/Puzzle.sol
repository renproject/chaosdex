pragma solidity ^0.5.12;

import "darknode-sol/contracts/Shifter/ShifterRegistry.sol";
import "darknode-sol/contracts/libraries/Compare.sol";

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract Puzzle is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    bytes public secretHash;     // The hash of the secret
    string public tokenSymbol;   // The symbol of the reward token
    bool public rewardClaimed;   // Whether the puzzle has been solved or not

    uint256 public maxGasPrice;  // Max tx gas price to avoid front running

    ShifterRegistry public registry;

    modifier onlyNotFrontRunning() {
        require(tx.gasprice <= maxGasPrice, "gas price is too high");
        _;
    }

    event LogRewardClaimed(bytes _rewardAddress, bytes _secret, uint256 _rewardAmount);

    /// @param _registry The Shifter registry contract address
    /// @param _tokenSymbol The token symbol for the reward and the shifting
    /// @param _secretHash The secret hash
    constructor(
        ShifterRegistry _registry,
        string memory _tokenSymbol,
        bytes memory _secretHash,
        uint256 _maxGasPrice
    ) public {
        registry = _registry;
        tokenSymbol = _tokenSymbol;
        secretHash = _secretHash;
        maxGasPrice = _maxGasPrice;
    }

    /// @notice The amount of reward for solving the puzzle
    function rewardAmount() public view returns (uint256) {
        ERC20 token = ERC20(registry.getTokenBySymbol(tokenSymbol));
        return token.balanceOf(address(this));
    }

    /// @notice Funds the contract with claimable rewards
    /// @param _amount The amount of token provided to the Darknodes in Sats.
    /// @param _nHash The hash of the nonce returned by the Darknodes.
    /// @param _sig The signature returned by the Darknodes.
    function fund(
        // Required
        uint256      _amount,
        bytes32      _nHash,
        bytes memory _sig
    ) public {
        require(_amount > 0, "amount must be greater than 0");
        registry.getShifterBySymbol(tokenSymbol).shiftIn(0x0, _amount, _nHash, _sig);
    }

    /// @notice Transfers tokens from the contract to reduce the amount of reward.
    ///
    /// @param _tokenAddress The address of the ERC20 token
    /// @param _amount  The amount to transfer
    /// @param _transferTo The destination address to send ERC20 tokens to
    function transfer(address _tokenAddress, uint256 _amount, address _transferTo) external onlyOwner {
        ERC20(_tokenAddress).transfer(_transferTo, _amount);
    }

    /// @notice Validate that the secret is correct. Use this function to
    ///         validate your answer if you think you've got it before
    ///         submitting a swap. You could also use this to brute-force
    ///         the answer too if you want.
    ///
    /// @param _secret The secret.
    function validateSecret(bytes memory _secret) public view returns (bool) {
        bytes memory h = abi.encodePacked(sha256(_secretMessage(_secret)));
        return Compare.bytesEqual(h, secretHash);
    }

    function _secretMessage(bytes memory _secret) internal pure returns (bytes memory) {
        return abi.encodePacked(
            "Secret(", string(_secret),
            ")"
        );
    }

}
