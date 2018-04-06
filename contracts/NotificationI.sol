/**
 * @description Notification Interface
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

pragma solidity ^0.4.21;


/** @title Insurance Pool's Notification Interface */
interface NotificationI {
    function ping(uint8 _subject, bytes32 _message, uint _scheduledDateTime) external returns (uint);
}