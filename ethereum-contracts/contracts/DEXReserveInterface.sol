pragma solidity ^0.5.8;


interface DEXReserveInterface {
    function buy(address _to, address _from, uint256 _daiAmount) external payable returns (uint256);

    function sell(address _to, address _from, uint256 _tokenAmount) external payable returns (uint256);

    function calculateBuyRcvAmt(uint256 _sendAmt) external view returns (uint256);

    function calculateSellRcvAmt(uint256 _sendAmt) external view returns (uint256);

    function removeLiquidity(address _liquidiyProvider, uint256 _liquidity) external;
    
    function addLiquidity(address _liquidiyProvider, uint256 _liquidity, uint256 _maxDAI, uint256 _deadline) external returns (uint256);
}