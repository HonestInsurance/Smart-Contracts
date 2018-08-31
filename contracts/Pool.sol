/**
 * @description Pool contract
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

pragma solidity ^0.4.24;

import "./Lib.sol";
import "./IntAccessI.sol";
import "./SetupI.sol";
import "./NotificationI.sol";
import "./Timer.sol";
import "./Bond.sol";
import "./Bank.sol";
import "./Policy.sol";
import "./Trust.sol";


/** @title Insurance Pool contract */
contract Pool is SetupI, IntAccessI, NotificationI {

    // Day of the Pool, Adjustment variables for Daylight saving
    uint public currentPoolDay = 0;
    bool public isWinterTime;
    bool public daylightSavingScheduled = false;

    // Bank account balances
    uint public WC_Bal_FA_Cu = 0;
    uint public WC_Bal_BA_Cu = 0;
    uint public WC_Bal_PA_Cu = 0;

    // Variables used by the Insurance Pool during overnight processing only
    bool public overwriteWcExpenses = false;
    uint public WC_Exp_Cu = 0;

    // Pool variables as defined in the model
    uint public WC_Locked_Cu = 0;
    uint public WC_Bond_Cu = 0;
    uint public WC_Transit_Cu = 0;
    uint public B_Yield_Ppb = MIN_YIELD_PPB;
    uint public B_Gradient_Ppq = 0;

    // Flag to indicate if the bond yield acceleration is operational (and scheduled by the timer)
    bool public bondYieldAccelerationScheduled = false;
    uint public bondYieldAccelerationThreshold = 0;

    // Events broadcasted by the Pool / Log events
    event LogPool(bytes32 indexed subject, uint indexed day, uint indexed value, uint timestamp);
    

    /**@dev Constructor of the Pool.
     * @param _trustAdr The address of the Trust contract.
     */
    constructor(address _trustAdr) IntAccessI(_trustAdr) public {
    }

    /**@dev Function initialises the pool relevant data - can only be called by the Trust
     * @param _isWinterTime Indicates if it is summer or winter time
     */
    function initEcosystem(bool _isWinterTime)
        public
        isTrustAuth
    {
        // Set the summer / winter time flag
        isWinterTime = _isWinterTime;

        // Variable to calculate the current pool day (days since 01/01/1970)
        currentPoolDay = uint(now / 1 days) + 1;
        // Calculate the next processing
        uint initialProcessingStart = uint(int(currentPoolDay * 1 days) + POOL_TIME_ZONE_OFFSET);

        // If the newly calculated epoch time is in the past add 24 hours
        if (initialProcessingStart < now) {
            initialProcessingStart = initialProcessingStart + 1 days;
            currentPoolDay++;
        }
        // Remove one day from total days to get to current day
        currentPoolDay--;

        // Add log entries
        emit LogPool(bytes32("SetInitialProcessingTime"), currentPoolDay, initialProcessingStart, now);

        // Schedule the pool's overnight processing
        Timer(getTimerAdr()).addNotification(
            initialProcessingStart + POOL_DAILY_PROCESSING_OFFSET_SEC,
            uint8(NotificationSubject.PoolOvernightProcessing), bytes32(0x0), address(0x0));
    }

    /**@dev Function re-calculates the insurance pool variables such as WC_Time, Delta, Bond, Yield, Gradient etc. 
            This function can only be called as a 'timed event'.
     * @return The time delta for re-scheduling the next notification (1 days)
     */
    function dailyOvernightProcessing()
        private
        returns (uint)
    {
        // ********************************************************************************
        // *** (1) Set yesterdayPoolDay as the currentPoolDay and increase current day
        // ********************************************************************************

        uint yesterdayPoolDay = currentPoolDay;
        // Current pool day is the NEW day at 12am (midnight)
        currentPoolDay++;
        

        // ********************************************************************************
        // *** (2) BANK PAYMENTS - yesterday's total premium and overflow payment
        // ********************************************************************************

        uint bondMaturityPayoutAmountNext3Days_Cu = 0;
        uint bondMaturityPayoutFuturePerDay_Cu = 0;

        // Retrieve the payout amounts from the bond contract
        (bondMaturityPayoutAmountNext3Days_Cu, bondMaturityPayoutFuturePerDay_Cu) = 
            Bond(getBondAdr()).getBondMaturityPayouts(currentPoolDay, currentPoolDay + (DURATION_TO_BOND_MATURITY_SEC / 1 days));

        // Get the total number of policy risk points
        uint totalPolicyRiskPoints = Policy(getPolicyAdr()).totalIssuedPolicyRiskPoints();

        // Add log entry
        emit LogPool(bytes32("TotalRiskPoints"), yesterdayPoolDay, totalPolicyRiskPoints, now);

        // *** Calculate total premium to be paid by all policy holders for yesterday;
        uint totalPremiumYesterday_Cu = 
            (totalPolicyRiskPoints * Policy(getPolicyAdr()).premiumPerRiskPoint_Cu_Ppm(yesterdayPoolDay, 0)) / (10**6);

        // Create payment advice
        if (totalPremiumYesterday_Cu > 0) {
            // Create payment advice for the premium payment
            Bank(getBankAdr()).createPaymentAdvice(Lib.PaymentAdviceType.Premium, BOND_ACCOUNT_PAYMENT_HASH, 
                bytes32(yesterdayPoolDay), totalPremiumYesterday_Cu, bytes32(getPoolAdr()));
            
            // Adjust WC_Bal_PA_Cu
            WC_Bal_PA_Cu -= totalPremiumYesterday_Cu;
        
            // Calculate the amounts to pay for safety net and pool operators
            uint paymentTrust = (totalPremiumYesterday_Cu * TRUST_FEE_PPT) / 10**3;
            uint paymentPoolOperators = (totalPremiumYesterday_Cu * POOL_OPERATOR_FEE_PPT) / 10**3;

            // Create payment advice for the trust if amount is greater than 1 cu
            if (paymentTrust >= 1) {
                // Create payment advice for trust
                Bank(getBankAdr()).createPaymentAdvice(Lib.PaymentAdviceType.Trust, TRUST_ACCOUNT_PAYMENT_HASH, 
                    bytes32(yesterdayPoolDay), paymentTrust, bytes32(getPoolAdr()));
                // Adjust WC_Bal_FA_Cu
                WC_Bal_FA_Cu -= paymentTrust;
            }

            // Create payment advice for pool operators if amount is greater than 1 cu
            if (paymentPoolOperators >= 1) {
                // Create payment advice for the pool operators
                Bank(getBankAdr()).createPaymentAdvice(Lib.PaymentAdviceType.PoolOperator, OPERATOR_ACCOUNT_PAYMENT_HASH, 
                    bytes32(yesterdayPoolDay), paymentPoolOperators, bytes32(getPoolAdr()));
                // Adjust WC_Bal_FA_Cu
                WC_Bal_FA_Cu -= paymentPoolOperators;
            }
        }
        // Add log entries
        emit LogPool(bytes32("PremiumCu"), yesterdayPoolDay, totalPremiumYesterday_Cu, now);

        // If the amount held in the Bond Account exceeds 5 times bondMaturityPayoutFuturePerDay_Cu balance create an OVERFLOW PAYMENT advice
        if (WC_Bal_BA_Cu > 5 * bondMaturityPayoutFuturePerDay_Cu) {
            // Calculate the overflow amount
            uint overflowAmount_Cu = WC_Bal_BA_Cu - (5 * bondMaturityPayoutFuturePerDay_Cu);
            // Create payment advice for funds being sent to the Funding Account
            Bank(getBankAdr()).createPaymentAdvice(Lib.PaymentAdviceType.Overflow, FUNDING_ACCOUNT_PAYMENT_HASH, 
                bytes32(yesterdayPoolDay), overflowAmount_Cu, bytes32(getPoolAdr()));
            // Adjust WC_Bal_BA_Cu
            WC_Bal_BA_Cu -= overflowAmount_Cu;
            // Add log entries
            emit LogPool(bytes32("OverflowCu"), yesterdayPoolDay, overflowAmount_Cu, now);
        }

        // ********************************************************************************
        // *** (3) RECALCULATION of today's insurance pool variables (IP Yield, IP Gradient, WC_BOND, WC_DELTA)
        // ********************************************************************************

        // Get the expense forecast for the new day
        if (overwriteWcExpenses == false) {
            // Get the total expenses of the pool for yesterday from the bank and update WC_Exp_Cu
            WC_Exp_Cu = ((WC_Exp_Cu * (DURATION_WC_EXPENSE_HISTORY_DAYS - 1)) / DURATION_WC_EXPENSE_HISTORY_DAYS) + 
                Bank(getBankAdr()).getResetFundingAccountPaymentsTracking();
        } else {
            // To reset the bank payments tracking call the function but ignore the return value
            Bank(getBankAdr()).getResetFundingAccountPaymentsTracking();
            // Set overwriteWcExpenses to false to enable 'regular' processing for next day
            overwriteWcExpenses = false;
        }

        // Calculation of WC_Time in seconds for how long is the WC_Bal sufficient to fund insurance expenses
        // WC_Time can be negative
        int WC_Time = 0;
        // Verify if WC Expenses is greater than 0
        if (WC_Exp_Cu > 0)
            WC_Time = (int(WC_Bal_FA_Cu - WC_Locked_Cu) * int(DURATION_WC_EXPENSE_HISTORY_DAYS * 86400)) / int(WC_Exp_Cu);
        
        // Calculation of WC_Delta_Cu (The demand of new liquidity in Local Currency e.g. $)
        // WC_Delta_Cu can be negative
        int WC_Delta_Cu = ((int(WC_POOL_TARGET_TIME_SEC) - WC_Time) * int(WC_Exp_Cu)) / int(DURATION_WC_EXPENSE_HISTORY_DAYS * 86400);
        
        // Calculation of the amount that should be issued as bonds taking TRANSIT money into account
        // If the calculated Bond value is negative set it to 0
        if (WC_Delta_Cu - int(WC_Transit_Cu) > 0)
            WC_Bond_Cu = uint(WC_Delta_Cu) - WC_Transit_Cu;
        else 
            WC_Bond_Cu = 0;

        // Calculation of Yield - Yield must always be at least the minimum yield as defined by the pool
        if (B_Yield_Ppb < MIN_YIELD_PPB)
            B_Yield_Ppb = MIN_YIELD_PPB;

        // Calculation of the Gradient if Bond is greater than 0;
        if (WC_Bond_Cu > 0)
            B_Gradient_Ppq = uint((B_Yield_Ppb * uint(10**6)) / uint(WC_Bond_Cu));
        else 
            B_Gradient_Ppq = 0;

        // Calculate the yield acceleration threshold
        bondYieldAccelerationThreshold = (WC_Bond_Cu * YAC_EXPENSE_THRESHOLD_PPT) / 10**3;

        // If yield acceleration has been deactivated
        if (bondYieldAccelerationScheduled == false) {
            // Activate the bond yield acceleration and set the flag to true
            bondYieldAccelerationScheduled = true;
            // Schedule the Yield Acceleration to start in 1 minute (60 seconds)
            Timer(getTimerAdr()).addNotification(
                now + 60, 
                uint8(NotificationSubject.BondYieldAcceleration), bytes32(0x0), address(0x0));
        }

        // Add log entries
        emit LogPool(bytes32("WcExpenseForecastCu"), currentPoolDay, WC_Exp_Cu, now);
        emit LogPool(bytes32("WcBondCu"), currentPoolDay, WC_Bond_Cu, now);
        emit LogPool(bytes32("BondGradientPpq"), currentPoolDay, B_Gradient_Ppq, now);
        emit LogPool(bytes32("BondYieldPpb"), currentPoolDay, B_Yield_Ppb, now);


        // ********************************************************************************
        // *** CALCULATION of todays's insurance PREMIUM PER RISK POINT
        // ********************************************************************************

        // Today's total premium to be charged
        uint totalPremiumTargetToday_Cu = bondMaturityPayoutFuturePerDay_Cu;
        
        // Check if [required delta amount to cover bond payouts over next 3 days] is greater then [average bond maturity payout amount (that would be charged by default)]
        if (bondMaturityPayoutAmountNext3Days_Cu > WC_Bal_BA_Cu + totalPremiumYesterday_Cu) {
            // Check if the required demand for topping up is greater than the default bond Maturity payout future per day value
            if (bondMaturityPayoutAmountNext3Days_Cu - WC_Bal_BA_Cu - totalPremiumYesterday_Cu > bondMaturityPayoutFuturePerDay_Cu)
                totalPremiumTargetToday_Cu = bondMaturityPayoutAmountNext3Days_Cu - WC_Bal_BA_Cu - totalPremiumYesterday_Cu;
        }

        // Calculate the premium per risk point in Cu Ppm if policies with risk points exist
        Policy(getPolicyAdr()).setPremiumPerRiskPoint(
            (totalPolicyRiskPoints > 0 ? (totalPremiumTargetToday_Cu * (10**6))/totalPolicyRiskPoints : 0), 
            currentPoolDay
        );

        // Add log entries
        emit LogPool(bytes32("BondPayoutNext3DaysCu"), currentPoolDay, bondMaturityPayoutAmountNext3Days_Cu, now);
        emit LogPool(bytes32("BondPayoutFutureCu"), currentPoolDay, bondMaturityPayoutFuturePerDay_Cu, now);
        emit LogPool(bytes32("PremiumPerRiskPointPpm"), currentPoolDay, Policy(getPolicyAdr()).premiumPerRiskPoint_Cu_Ppm(currentPoolDay, 0), now);

        // ********************************************************************************
        // *** Book the timer notification for the first batch of policy processing
        // ********************************************************************************

        // Book a new timer notification to process the first batch of policies in 5 min from now if required
        (uint firstIdx,,) = Policy(getPolicyAdr()).hashMap();
        // Schedule the first batch of policy processing
        Timer(getTimerAdr()).addNotification(now + 300, uint8(0), bytes32(firstIdx), Policy(getPolicyAdr()));

        // ********************************************************************************
        // *** Return the time when the next processing needs to occur
        // ********************************************************************************

        if (daylightSavingScheduled == false) {
            // return the next event notification to be scheduled in 1 day (==> 86.400 seconds <=> 24 * 3600 seconds)
            return 1 days;
        } else {
            // Set the Daylight saving adjustment flag to false
            daylightSavingScheduled = false;
            // Change the summer/winter time flag
            isWinterTime = (isWinterTime == true ? false : true);
            // return the next processing with the adjustoment of the next processing
            return uint(1 days + (isWinterTime == false ? int(POOL_DAYLIGHT_SAVING_ADJUSTMENT_SEC) * -1 : int(POOL_DAYLIGHT_SAVING_ADJUSTMENT_SEC)));
        }
    }

    /**@dev Function is called by the bond contract to submit a bond for signing
     * @param _bondPrincipal_Cu The bond's principal amount requested for signing.
     * @param _creditedBondAmount_Cu The pricipal amount that has already been paid by the bond owner
     * @return bondYield_Ppb The final yield approved by the pool for this bond
     */
    function signBond(uint _bondPrincipal_Cu, uint _creditedBondAmount_Cu)
        public
        isBondAuth
        returns (uint bondYield_Ppb)
    {
        // Update the insurance pool variable WC_Bond_Cu by considering the newly issued bond
        if (WC_Bond_Cu >= _bondPrincipal_Cu)
            WC_Bond_Cu -= _bondPrincipal_Cu;
        else 
            WC_Bond_Cu = 0;

        // Add the corresponding transit amount if the credited amount so far is 0
        if (_creditedBondAmount_Cu == 0)
            WC_Transit_Cu += _bondPrincipal_Cu;
        
        //  Calculate the new bond yield average
        uint yieldAvg = ((B_Gradient_Ppq * _bondPrincipal_Cu) / (2 * (10**6)));

        // Calculate the new bond yield and ensure it is at least the MIN_YIELD value
        if (B_Yield_Ppb - yieldAvg > MIN_YIELD_PPB)
            bondYield_Ppb = B_Yield_Ppb - yieldAvg;
        else 
            bondYield_Ppb = MIN_YIELD_PPB; 

        // If the yield adjustment droped the yield value below the minimum yield set it to the minimum
        if (B_Yield_Ppb - (2 * yieldAvg) > MIN_YIELD_PPB)
            B_Yield_Ppb -= (2 * yieldAvg);
        else 
            B_Yield_Ppb = MIN_YIELD_PPB;
    }

    /**@dev Finalises the Bond maturity processing - can only be called from the Bond contract
     * @param _finalBondPayment_Cu The amount to be payed out to the owner of the Bond.
     * @param _reduceWcTransit_Cu The amount to reduce WC transit.
     */
    function processMaturedBond(uint _finalBondPayment_Cu, uint _reduceWcTransit_Cu)
        public
        isBondAuth
    {
        // Reduce WC_Bal_BA_Cu - a check if sufficient funds are available are performed at the bond contract
        WC_Bal_BA_Cu -= _finalBondPayment_Cu;
        // Reduce WC_Transit by the transit amount
        WC_Transit_Cu -= _reduceWcTransit_Cu; 
    }

    /**@dev Function is called when a credit of local currency has been credited to an insurance pool's bank account.
     * @param _accountType The bank account the deposit was credited to (0-PremiumAccount; 1-BondAccount; 2-FundingAccount)
     * @param _paymentAccountHash The payment hash of the sender details (account name and number) of the funds
     * @param _paymentSubject Payment particular/code/reference to be specified for the bank transaction
     * @param _bankCreditAmount_Cu The amount that has been received at the bank.
     * @return The result of the Credit operation: Is empty if successfull otherwise reason for failure.
     */
    function processAccountCredit(
        Lib.AccountType _accountType, 
        bytes32 _paymentAccountHash, 
        bytes32 _paymentSubject, 
        uint _bankCreditAmount_Cu
        )
        public
        isBankAuth
        returns (bool success, bytes32 info, bytes32 internalReferenceHash)
    {
        // ******************************************************************************************
        // *** Payment into the Bond Account
        // ******************************************************************************************
        if (_accountType == Lib.AccountType.BondAccount) {
            // Verify if the payment has been received from the Premium holding account
            if (_paymentAccountHash == PREMIUM_ACCOUNT_PAYMENT_HASH) {
                // Increase the balance in the Bond Account
                WC_Bal_BA_Cu += _bankCreditAmount_Cu;
                // return success
                return (true, 0x0, bytes32(getPoolAdr()));
            } else {
                // An invalid external payment has been made into the Bond account - return false to refund payment
                return (false, bytes32("UnauthorisedPayment"), 0x0);
            }
        
        // ******************************************************************************************
        // *** Overflow payment | Internal payment from the Bond Account to the Funding Account
        // ******************************************************************************************
        } else if ((_paymentAccountHash == BOND_ACCOUNT_PAYMENT_HASH) && (_accountType == Lib.AccountType.FundingAccount)) {
            // If it is an overflow payment increase Funding account balance
            WC_Bal_FA_Cu += _bankCreditAmount_Cu;
            // return success
            return (true, 0x0, bytes32(getPoolAdr()));
        }
        
        // ******************************************************************************************
        // *** Policy Premium Payment | Process the credit of external Funds into the Premium Account
        // ******************************************************************************************
        if (_accountType == Lib.AccountType.PremiumAccount) {
            // Call the policy contract to process this credit
            (success, info, internalReferenceHash) = Policy(getPolicyAdr()).processAccountCredit(_paymentAccountHash, _paymentSubject, _bankCreditAmount_Cu);

            // If credit was successfull adjust WC_Bal_PA_Cu
            if (info == 0x0) {
                // Adjust WC_Bal_PA_Cu Funding Account
                WC_Bal_PA_Cu += _bankCreditAmount_Cu;
            }
            // Return the result of the policy credit payment
            return (success, info, internalReferenceHash); 

        // ******************************************************************************************
        // *** Bond Principal Payment | Process the credit of 'external' Funds into the Funding Account
        // ******************************************************************************************
        } else if (_accountType == Lib.AccountType.FundingAccount) {
            bool reduceWcTransit = false;
            // Call the bond contract to process this credit
            (success, info, internalReferenceHash, reduceWcTransit) = Bond(getBondAdr()).processAccountCredit(_paymentAccountHash, _paymentSubject, _bankCreditAmount_Cu, currentPoolDay);

            // If credit was successfull adjust WC_Transit_Cu and WC_Bal_FA_Cu
            if (info == 0x0) {
                // Adjust WC_Bal_FA_Cu Funding Account
                WC_Bal_FA_Cu += _bankCreditAmount_Cu;

                // Verify if WC_Transit_Cu needs to be adjusted (reduced)
                if (reduceWcTransit == true)
                    WC_Transit_Cu -= _bankCreditAmount_Cu;
            }
            // Return the result of the bond credit payment
            return (success, info, internalReferenceHash);
        }

        // Return the result of the Credit transaction
        return (false, bytes32("InvalidPayment"), 0x0);
    }

    // *******************************
    // *** Miscellaneous functions
    // *******************************

    /**@dev Function accellerates the Yield 
        This function can only be called from ping function as a 'timed event'.
     * @return The time delta for re-scheduling the next notification
     */
    function accelerateBondYield()
        private
        returns (uint)
    {
        // Only accellerate the yield if the WC Bond on sale is more than 10% of the daily expenses
        if (WC_Bond_Cu > bondYieldAccelerationThreshold) {
            // Increase the yield on offer for bonds
            B_Yield_Ppb = ((B_Yield_Ppb * (10**9 + YAC_PER_INTERVAL_PPB)) / (10**9));
            // Yield has exceeded the max yield
            if (B_Yield_Ppb > MAX_YIELD_PPB) {
                // Set the yield to the max yield
                B_Yield_Ppb = MAX_YIELD_PPB;
                // Set the bond yield acceleration flag to false
                bondYieldAccelerationScheduled = false;
                // Return 0 to not re-schedule the yield acceleration
                return uint(0);
            }
            // Schedule the next acceleration of the Yield
            return YAC_INTERVAL_DURATION_SEC;
        } else {
            // Set the bond yield acceleration flag to false
            bondYieldAccelerationScheduled = false;
            // Return 0 to not re-schedule the yield acceleration
            return uint(0);
        }
    }

    /**@dev Function overwrites the WC_Exp_Cu to use for next overnight processing.
            Preauthorisation is required to perform this operation.
     * @param _wcExpenses_Cu Total Expenses of the pool within the DURATION_WC_EXPENSE_HISTORY_DAYS period
     */
    function setWcExpenses(uint _wcExpenses_Cu)
        public
        isTrustAuth
    {
        // Set the value to use for WC Expenses for next overnight processing
        WC_Exp_Cu = _wcExpenses_Cu;
        // Set the flag that wc expenses has been overwritten
        overwriteWcExpenses = true;
        // Add log entry
        emit LogPool(bytes32("WcExpensesAdjustmentCu"), currentPoolDay, _wcExpenses_Cu, now);
    }

    /**@dev Function needs to be called by the  pool owners to inform the pool about daylight saving and leap second adjustments
            within the 24 hours before the event occurs. Preauthorisation is required to perform this operation.
     */
    function adjustDaylightSaving()
        public
        isTrustAuth
    {
        // Ensure a change of daylight saving is not already scheduled
        require(daylightSavingScheduled == false);
        // Set the flag to schedule the daylight saving change
        daylightSavingScheduled = true;
        // Create a log entry to document the change
        if (isWinterTime == true)
            emit LogPool(bytes32("ChangeToSummerTime"), currentPoolDay, 0, now);
        else 
            emit LogPool(bytes32("ChangeToWinterTime"), currentPoolDay, 0, now);
    }

    /**@dev Function can only be called by the Settlement contract to adjust the WC Locked amount.
     */
    function adjustWcLocked(uint amount, bool addAmount)
        public
        isSettlementAuth
    {
        if (addAmount == true) {
            // Inrease the Wc_Locked_Cu
            WC_Locked_Cu += amount;
        } else {
            WC_Locked_Cu -= amount;
        }
    }

    /**@dev Executes on a ping notification initiated by the Timer
     * @param _subject The subject of the ping notifiction
     * @param _message The message of the ping notifiction
     * @param _scheduledDateTime The time the notification was scheduled for
     * @return The delta time in seconds to add to _dateTime to re-schedule the next ping; 0 for no re-scheduling.
     */
    function ping(uint8 _subject, bytes32 _message, uint _scheduledDateTime)
        external
        isTimerAuth
        returns (uint)
    {
        // Internal verification - ensure not _message has been provided by the Timer
        assert(_message == bytes32(0x0));
        // Internal verification - ensure scheduled Date Time is set
        assert(_scheduledDateTime >= 0);

        if (_subject == uint8(NotificationSubject.BondYieldAcceleration))
            return accelerateBondYield();

        if (_subject == uint8(NotificationSubject.PoolOvernightProcessing))
            return dailyOvernightProcessing();

        return 0;
    }

    // *******************************
    // *** Structs and Enums
    // *******************************

    /**@dev Enum of the diffent Notification subjects of the pool
    */
    enum NotificationSubject {
        /*0*/ BondYieldAcceleration,
        /*1*/ PoolOvernightProcessing
    }
}
