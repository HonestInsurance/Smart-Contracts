/**
 * @description Timer contract
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

pragma solidity ^0.4.24;

import "./IntAccessI.sol";
import "./NotificationI.sol";


/** @title Timer contract to implement ping functionality.*/
contract Timer is IntAccessI {

    // The inception date of this contract
    uint public TIMER_INCEPTION_DATE;
    // Store the time ping was executed the last time (in 10 seconds intervalls)
    uint public lastPingExec_10_S = now / 10;

    // Struct to store the notifications in
    struct NotificationEntry {
        address notificationAddress;
        uint8 subject;
        bytes32 message;
    }

    // Mapping to store the notificatoins in an array of 10 second intervalls
    mapping(uint => NotificationEntry[]) public notification;
    // Mapping to speed up iterations by using 100 seconds intervals
    mapping(uint => bool) public timeIntervalHasEntries;

    /**@dev Constructor of the  Timer.
     * @param _trustAdr The address of the Trust this timer belongs to
     */
    constructor(address _trustAdr) IntAccessI(_trustAdr) public {
        TIMER_INCEPTION_DATE = now;
    }

    /**@dev Function to add a notification event to the Timer.
     * @param _dateTime The time the notification needs to be triggered
     * @param _subject The subject of the notification
     * @param _message The message of the notification
     * @param _targetAdr The address to ping in case msg.sender should not be used
     */
    function addNotification(uint _dateTime, uint8 _subject, bytes32 _message, address _targetAdr)
        public
        isIntAuth
    {
        // Ensure _dateTime proposed is a DateTime in the future
        require(_dateTime > now);

        // Add the new notification to the array in mapping - If target address is not defined set it to be msg.sender's address
        notification[_dateTime / 10].push(NotificationEntry({
            notificationAddress: (_targetAdr == address(0x0) ? msg.sender : _targetAdr),
            subject: _subject,
            message: _message
        }));

        // Set the has entries mapping for this 100-second interval to true
        timeIntervalHasEntries[_dateTime / 100] = true;
    }

    /**@dev Function to execute the ping notifications scheduled since last ping
     */
    function ping() public {
        // Get the time now as a 10 second intervall --- This 10 second interval is also to be executed
        uint timeNow_10_S = now / 10;

        // 100 second loop interation
        for (uint i_100_S = lastPingExec_10_S / 10; i_100_S <= timeNow_10_S / 10; i_100_S++) {
            // Verify it this intervall has entries
            if (timeIntervalHasEntries[i_100_S] == true) {
                // Iterate throught the 10 slots within this 100 second itervall
                for (uint j_10_S = i_100_S * 10; j_10_S < (i_100_S + 1) * 10 ; j_10_S++) {
                    // Verify if the selected 10 second time slot is within
                    //    => the lower or equal bound of lastPingExec_10_S and 
                    //    => the higher or equal bound of timeNow_10_S
                    if ((j_10_S >= lastPingExec_10_S) && (j_10_S <= timeNow_10_S)) {
                        // Iterate through every entry in a slot
                        for (uint k = 0; k<notification[j_10_S].length; k++) {
                            // Invoke the ping notification using the contracts address
                            uint rescheduleTimeDelta = NotificationI(notification[j_10_S][k].notificationAddress).ping(notification[j_10_S][k].subject, notification[j_10_S][k].message, j_10_S * 10);
                            // if the ping returns a reschedule value greater 0 => reschedule the notification
                            if (rescheduleTimeDelta > 0) {
                                // Calculate the new reschedule DateTime
                                uint nextPingEventDateTime_10_S = j_10_S + (rescheduleTimeDelta / 10);
                                // Add the next ping notification to the mapping
                                notification[nextPingEventDateTime_10_S].push(NotificationEntry({
                                    notificationAddress: notification[j_10_S][k].notificationAddress,
                                    subject: notification[j_10_S][k].subject,
                                    message: notification[j_10_S][k].message
                                    }
                                ));
                                // Set the has entries mapping for this 10-second interval to true
                                timeIntervalHasEntries[nextPingEventDateTime_10_S / 10] = true;
                            }
                        }
                    }
                }
            }
        }
        // Set the next ping execution timeslot timeNow_10_S + 1
        lastPingExec_10_S = timeNow_10_S + 1;
    }

    /**@dev Returns the number of scheduled ping notifications for the specified timestamp period
     * @param _timestampPeriod The 10 second period for which to check if notifications exist
     * @return Number of notifications scheduled for the period specified.
     */
    function getTimerNotificationCount(uint _timestampPeriod) 
        public
        view
        returns (uint) 
    {
        return notification[_timestampPeriod].length;
    }

    /**@dev Returns the time of the blockchain
     * @return Current time of the blockchain (EPOCH)
     */
    function getBlockchainEPOCHTime() 
        public
        view
        returns (uint) 
    {
        return now;
    }

    // ********************************************************************
    // *** Helper functions for testing - Needs to be removed in production
    // ********************************************************************

    function manualPing(address _pingAdr, uint8 _subject, bytes32 _message, uint _scheduledDateTime) public {
        NotificationI(_pingAdr).ping(_subject, _message, _scheduledDateTime);
        // Set the next ping execution to now
        lastPingExec_10_S = now / 10;
    }
}
