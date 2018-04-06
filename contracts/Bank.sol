/**
 * @description Bank contract
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

pragma solidity ^0.4.21;

import "./Lib.sol";
import "./Pool.sol";


/** @title Bank contract used by the payment service provider to interact with the pool.*/
contract Bank is IntAccessI, ExtAccessI {

    // Storage struct for all payment advice transactions the bank needs to perform
    struct PaymentAdvice {
        Lib.PaymentAdviceType adviceType;
        bytes32 paymentAccountHashRecipient;
        bytes32 paymentSubject;
        uint amount;
        bytes32 internalReferenceHash;
    }

    // Array to store the payment advice instructions
    PaymentAdvice[] public bankPaymentAdvice;

    // Index pointing to the last payment advice entry in the PaymentAdvice array
    uint public countPaymentAdviceEntries = 0;

    // Mapping to store the unique bank transaction reference numbers to avoid double processing
    mapping(uint => bool) public bankTransactionIdxProcessed;

    // Expense tracking variable for the last 24 hours
    uint public fundingAccountPaymentsTracking_Cu = 0;

    // Transaction log entries for all bank transactions
    event LogBank(bytes32 indexed internalReferenceHash, uint indexed accountType, bool indexed success, bytes32 paymentAccountHash, bytes32 paymentSubject, bytes32 info, uint timestamp, uint transactionType, uint amount);

    /**@dev Constructor of the Bank.
     * @param _trustAdr The address of the Trust.
     */
    function Bank(address _trustAdr) IntAccessI(_trustAdr) ExtAccessI(msg.sender) public {
    }

    /**@dev Resets the fundingAccountPaymentsTracking_Cu varialbe to 0
     * @return The total amount of expenses from the Funding Account since last processing.
     */
    function getResetFundingAccountPaymentsTracking()
        public
        isPoolAuth
        returns (uint)
    {
        // Save the value for the return
        uint payments = fundingAccountPaymentsTracking_Cu;
        // Reset fundingAccountPaymentsToday to start from 0
        fundingAccountPaymentsTracking_Cu = 0;
        // return payments today value
        return payments;
    }

    /**@dev Creates a payment advice for the bank to process
     * @param _adviceType The type of payment to be performed
     * @param _paymentAccountHashRecipient The account hash of the party RECEIVING the funds
     * @param _paymentSubject Payment particular/code/reference to be specified for the bank transaction
     * @param _amount_Cu The requested amount to be paid.
     * @param _internalReferenceHash The hash of the bond, policy, etc. this bank transaction belongs to (used as a reference for logging)
     */
    function createPaymentAdvice(
        Lib.PaymentAdviceType _adviceType,
        bytes32 _paymentAccountHashRecipient,
        bytes32 _paymentSubject,
        uint _amount_Cu,
        bytes32 _internalReferenceHash
        )
        public
        isIntAuth
    {
        // If it is payment advice instruction from the funding account record it in the fundingAccountPaymentsTracking_Cu variable
        if ((_adviceType == Lib.PaymentAdviceType.ServiceProvider) || (_adviceType == Lib.PaymentAdviceType.Trust) || (_adviceType == Lib.PaymentAdviceType.PoolOperator)) {
            // Add the amount to the fundingAccountPaymentsToday variable
            fundingAccountPaymentsTracking_Cu += _amount_Cu;
        }

        // Add payment advice to list
        bankPaymentAdvice.push(PaymentAdvice({
            adviceType: _adviceType,
            paymentAccountHashRecipient: _paymentAccountHashRecipient,
            paymentSubject: _paymentSubject,
            amount: _amount_Cu,
            internalReferenceHash: _internalReferenceHash
        }));

        // Increase the number of payment advice entries
        countPaymentAdviceEntries++;
    }

    /**@dev Called by the bank when the specified payment advice has been processed.
     * @param _idx Specifies the processed payment advice
     * @param _bankTransactionIdx The unique index referencing the bank transaction record
     */
    function processPaymentAdvice(uint _idx, uint _bankTransactionIdx)
        public
        isExtAuth
    {
        // Ensure the idx to process is valid.
        require(bankPaymentAdvice.length > _idx);

        // If the array holds the idx verify if it has not already been processed (is empty entry)
        require(bankPaymentAdvice[_idx].amount != 0);
        
        // Verify the bankTransactionIdx has not already been processed
        require(bankTransactionIdxProcessed[_bankTransactionIdx] == false);

        // Mark the bank transaction index as processed to avoid double processing
        bankTransactionIdxProcessed[_bankTransactionIdx] = true;

        // Get the corresponding account type based on adviceType
        Lib.AccountType accType;
        if ((bankPaymentAdvice[_idx].adviceType == Lib.PaymentAdviceType.PremiumRefund) ||
            (bankPaymentAdvice[_idx].adviceType == Lib.PaymentAdviceType.Premium))
            accType = Lib.AccountType.PremiumAccount;
        else if ((bankPaymentAdvice[_idx].adviceType == Lib.PaymentAdviceType.BondMaturity) ||
            (bankPaymentAdvice[_idx].adviceType == Lib.PaymentAdviceType.Overflow))
            accType = Lib.AccountType.BondAccount;
        else 
            accType = Lib.AccountType.FundingAccount;

        // Add bank transaction log entry
        emit LogBank(
            bankPaymentAdvice[_idx].internalReferenceHash,
            uint(accType),
            true,
            bankPaymentAdvice[_idx].paymentAccountHashRecipient,
            bankPaymentAdvice[_idx].paymentSubject,
            0x0,
            now,
            uint(Lib.TransactionType.Debit),
            bankPaymentAdvice[_idx].amount
        );

        // Remove (overwrite) entry from the array
        bankPaymentAdvice[_idx].paymentAccountHashRecipient = 0x0;
        bankPaymentAdvice[_idx].paymentSubject = "";
        bankPaymentAdvice[_idx].amount = 0;
        bankPaymentAdvice[_idx].internalReferenceHash = 0x0;

        // If the current _idx is the last one, verify if all the elements are removed from the array
        if (_idx == bankPaymentAdvice.length - 1) {
            // Verify if all entries have been processed
            for (uint i = 0; i < bankPaymentAdvice.length; i++) {
                // If any other payment advice exist in the list return
                if (bankPaymentAdvice[i].amount != 0)
                    return;
            }
            // As no entries exist in bankPaymentAdvice array any more, delete the entire array
            delete bankPaymentAdvice;
            // Reset the number of payment advice entries to 0
            countPaymentAdviceEntries = 0;
        }
    }

    /**@dev Function is called when currency has been credited to any of the insurance pool's bank account.
     * @param _bankTransactionIdx The index referencing the this bank transaction record uniquely (is used to avoid double processing)
     * @param _accountType The bank account index of the pool (0-PremiumAccount; 1-BondAccount; 2-FundingAccount)
     * @param _paymentAccountHashSender Hash of the sender's name and bank account number
     * @param _paymentSubject Payment particular/code/reference to be specified for the bank transaction
     * @param _bankCreditAmount_Cu The amount that has been received at the bank.
     * @return The result of the Deposit operation. True if successfull, false the bank needs to be transfer the deposit back to the sender.
     */
    function processAccountCredit(
        uint _bankTransactionIdx,
        uint _accountType,
        bytes32 _paymentAccountHashSender,
        bytes32 _paymentSubject,
        uint _bankCreditAmount_Cu
        )
        public
        isExtAuth
        returns (bool)
    {
        // Ensure the bankTransactionIdx has not already been processed
        require(bankTransactionIdxProcessed[_bankTransactionIdx] == false);
        
        // Ensure the account type is either PremiumAccount, BondAccount or FundingAccount
        require((Lib.AccountType(_accountType) == Lib.AccountType.PremiumAccount) || (Lib.AccountType(_accountType) == Lib.AccountType.BondAccount) || (Lib.AccountType(_accountType) == Lib.AccountType.FundingAccount));
        
        // Verify a paymentAccountHash has been provided for the sender
        require(_paymentAccountHashSender != bytes32(0x0));

        // Mark the bank transaction index as processed to avoid double processing
        bankTransactionIdxProcessed[_bankTransactionIdx] = true;
        
        bool success;
        bytes32 info;
        bytes32 internalReferenceHash;
        
        // Process the deposit with the pool
        (success, info, internalReferenceHash) = Pool(getPoolAdr()).processAccountCredit(Lib.AccountType(_accountType), _paymentAccountHashSender, _paymentSubject, _bankCreditAmount_Cu);
        
        emit LogBank(
            internalReferenceHash,
            _accountType,
            true,
            _paymentAccountHashSender,
            _paymentSubject,
            info,
            now,
            uint(Lib.TransactionType.Credit),
            _bankCreditAmount_Cu
        );

        // // If operation was unsuccessfull
        if (success == false) {
            // Add bank transaction log entry to document the refund of the previously failed Credit operation
            emit LogBank(
                internalReferenceHash, uint(_accountType), true,
                _paymentAccountHashSender, _paymentSubject, bytes32("Refund"),
                uint(now), uint(Lib.TransactionType.Debit), _bankCreditAmount_Cu);
        }

        // Return the result of the deposit processing transaction
        return success;
    }
}