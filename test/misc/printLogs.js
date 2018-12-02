/**
 * @description Functions to print contract event logs to the console
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

const miscFunc = require("./miscFunc.js");
const printLogFiles = require("./printLogs.js");
const td = require("../misc/testData.js");

// Block number
const blockNumberStart = 0;//web3.eth.blockNumber;

// event LogTrust(bytes32 indexed subject, address indexed adr, bytes32 indexed info, uint timestamp);
exports.printTrustLogs = async (_subject, _adr, _info) => {
    // Retrieve all the logs
    const logs = await td.trust.getPastEvents('LogTrust', {
        filter:{ subject: _subject, adr: _adr, info: _info }, 
        fromBlock: 0,
        toBlock: 'latest'
    });
    // Print header
    console.log('');
    console.log('Trust: '+ td.trust.address);
    console.log('================================================');
    for (let i=0; i<logs.length; i++){
        console.log(
            miscFunc.getLocalDateStringFromEpoch(logs[i].args.timestamp) + '   ' + 
            web3.utils.padRight(web3.utils.hexToUtf8(logs[i].args.subject), 25, ' ') + '   ' + 
            logs[i].args.adr + '   ' +
            miscFunc.shortenHash(logs[i].args.info)
        );
    }
    console.log('');
    console.log('');
}

//event LogPool(bytes32 indexed subject, uint indexed day, uint indexed value, uint timestamp);
exports.printPoolLogs = async (_subject, _day, _value) => {
    // Retrieve all the logs
    const logs = await td.pool.getPastEvents('LogPool', { 
        filter: {subject: _subject, day: _day, value: _value },
        fromBlock: blockNumberStart, 
        toBlock: "latest" 
    });
    // Variable to store the last day
    let lastPrintedDay = 0;
    // Print header
    console.log('');
    console.log('Pool: '+ td.pool.address);
    console.log('================================================');
    for (let i=0; i<logs.length; i++){
        let subject = web3.utils.padRight(web3.utils.hexToUtf8(logs[i].args.subject), 25, ' ');
        let day = miscFunc.formatNr(logs[i].args.day.toNumber(), false, 15, false, false);
        let value;
        if (subject.indexOf("Cu") != -1)
            value = miscFunc.formatNr(logs[i].args.value.toNumber(), true, 18);
        else value = miscFunc.formatNr(logs[i].args.value.toNumber(), false, 18, false, true);

        if (day != lastPrintedDay) {
            if (i != 0) {
                console.log('---------------------------------------------------------------------------------------------------');
            }
            lastPrintedDay = day;
        }
        console.log(
            miscFunc.getLocalDateStringFromEpoch(logs[i].args.timestamp) + '   ' + 
            subject + '   ' + 
            day + '   ' +
            value
        );
    }
    console.log('');
    console.log('');
}

// event LogBankAccountTransaction(uint timestamp, uint bankTransactionIdx, uint indexed accountType, uint transactionType, 
//    bytes32 paymentAccountHash, bytes32 paymentSubject, uint amount, bool indexed success, bytes32 indexed internalReferenceHash, bytes32 info);
exports.printBankLogs = async (_accountType, _success, _hash) => {
    // Array to store the Transaction states
    let accType = ['PremiumHoldingAccount', 'BondHoldingAccount   ', 'FundingAccount       '];
    let transType = ['Credit', 'Debit '];

    // Retrieve all the logs
    const logs = await td.bank.getPastEvents('LogBank', { 
        filter: { accountType: _accountType, success: _success, internalReferenceHash: _hash },
        fromBlock: blockNumberStart, 
        toBlock: "latest" 
    });

    // Print header
    console.log('');
    console.log('Bank account transaction logs:');
    console.log('==============================');
    for (let i=0; i<logs.length; i++){
        console.log(miscFunc.getLocalDateStringFromEpoch(logs[i].args.timestamp) + '   ' + 
            accType[logs[i].args.accountType.toNumber()] + '   ' + 
            transType[logs[i].args.transactionType.toNumber()] + '   ' + 
            miscFunc.formatNr(logs[i].args.amount.toNumber(), true, 15) + '   ' + 
            ((logs[i].args.success == true) ? 'true ' : 'false') + '   ' + 

            // If it is an internal Pool transaction (internal reference hash is address of pool)
            ((logs[i].args.internalReferenceHash == web3.utils.padLeft(td.pool.address, 64).toLowerCase()) ?
                miscFunc.formatNr(parseInt(logs[i].args.paymentSubject), false, 13, true, false) :
                miscFunc.shortenHash(logs[i].args.paymentSubject)) + '   ' + 
            
            ((logs[i].args.internalReferenceHash == web3.utils.padLeft(td.pool.address, 64).toLowerCase()) ?
            'Pool            ' :
            miscFunc.shortenHash(logs[i].args.internalReferenceHash) + '   ') + 
            
            ((logs[i].args.info != 0) ? logs[i].args.info : '-')
        );
    }
    console.log('');  
    console.log('');
}

// Printing all payment advice entries that are outstanding for processing
exports.printBankPaymentAdvice = async () => {
    // Array to store the payment advice types in
    let adviceType = ['PremiumRefund  ', 'Premium        ', 'BondMaturity   ', 
                      'Overflow       ', 'PoolOperator   ', 'ServiceProvider',
                      'Trust          '];

    // Retrieve the number of payment advice entries
    const countNextLast = await td.bank.countPaymentAdviceEntries();
    // Print header
    console.log('');
    console.log('Bank payment advice entries:');
    console.log('============================');
    for (let i=0; i < countNextLast.toNumber(); i++) {
        let log = await td.bank.bankPaymentAdvice(i);
        if (log.amount.toNumber() != 0) {
            console.log(
                adviceType[log.adviceType.toNumber()] + '   ' + 
                log.paymentAccountHashRecipient + '   ' + 

                ((log.internalReferenceHash == web3.utils.padLeft(td.pool.address, 64).toLowerCase()) ?
                    miscFunc.formatNr(parseInt(log.paymentSubject), false, 13, true, false) :
                    miscFunc.shortenHash(log.paymentSubject)) + '   ' + 

                miscFunc.formatNr(log.amount.toNumber(), true, 15) + '   ' +
            
                ((log.internalReferenceHash == web3.utils.padLeft(td.pool.address, 64).toLowerCase()) ?
                    'Pool            ' :
                    miscFunc.shortenHash(log.internalReferenceHash))

            );
        }
    }
    console.log('');  
    console.log('');
}

//event LogBond(bytes32 indexed bondHash, address indexed owner, bytes32 indexed info, uint timestamp, uint state);
exports.printBondLogs = async (_bondHash, _owner, _info) => {
    // Array to store the Bond states
    let bondState = [   'Created                  ', 'SecuredBondPrincipal     ', 'SecuredReferenceBond     ', 
                        'Signed                   ', 'Issued                   ', 'LockedReferenceBond      ',
                        'Defaulted                ', 'Matured                  '];
    
    // Retrieve all the logs
    const logs = await td.bond.getPastEvents('LogBond', { 
        filter: { bondHash: _bondHash, owner: _owner, info: _info },
        fromBlock: blockNumberStart, 
        toBlock: "latest" 
    });

    // Print header
    console.log('');
    if ((_bondHash == null) && (_owner == null) && (_info == null))
        console.log('Bond: ' + '--- all logs ---');
    else {
        let msg = 'Bond: ';
        if (_bondHash != null) msg = msg + 'Hash is ' + _bondHash + '   ';
        if (_owner != null)  msg = msg + 'Owner is ' + _owner + '   ';
        if (_info != null)  msg = msg + 'Info is ' + _info;
        console.log(msg);
    }
    console.log('================================================');
    for (let i=0; i<logs.length; i++){
        let hashPrint;
        let statePrint;
        let infoPrint;
        
        if (logs[i].args.bondHash == miscFunc.getEmptyHash()) {
            hashPrint =  '-            ';
            statePrint = '-                        ';
            infoPrint = miscFunc.hexToAscii(logs[i].args.info, 22);
        }
        else {
            hashPrint = miscFunc.shortenHash(logs[i].args.bondHash);
            statePrint = bondState[logs[i].args.state.toNumber()];
            if ((logs[i].args.state.toNumber() == 2) || (logs[i].args.state.toNumber() == 5))
                infoPrint = '         ' + miscFunc.shortenHash(logs[i].args.info);
            else if (logs[i].args.state.toNumber() == 3)
                infoPrint = miscFunc.formatNr(parseInt(logs[i].args.info), false, 22, false, true);
            else if (logs[i].args.state.toNumber() == 4)
                infoPrint = '   ' + miscFunc.getLocalDateStringFromEpoch(parseInt(logs[i].args.info));
            else infoPrint = miscFunc.formatNr(parseInt(logs[i].args.info), true, 22);
        }

        console.log(miscFunc.getLocalDateStringFromEpoch(logs[i].args.timestamp) + '   ' + 
            hashPrint + '   ' +
            statePrint + '   ' +
            infoPrint + '   ' + 
            logs[i].args.owner
            );
    }
    console.log('');
    console.log('');
}

//event LogPolicy(bytes32 indexed policyHash, address indexed owner, bytes32 indexed info, uint timestamp, uint state);
exports.printPolicyLogs = async (_policyHash, _owner, _info) => {
    // Array to store the Policy states
    let policyState = [ 'Paused       ', 'Issued       ', 'Lapsed       ', 'Post-Lapsed  ', 'Retired      ' ];
    
    // Retrieve all the logs
    const logs = await td.policy.getPastEvents('LogPolicy', { 
        filter: { policyHash: _policyHash, owner: _owner, info: _info },
        fromBlock: blockNumberStart, 
        toBlock: "latest" 
    });

    // Print header
    console.log('');
    if ((_policyHash == null) && (_owner == null) && (_info == null))
        console.log('Policy: ' + '--- all logs ---');
    else {
        let msg = 'Policy: ';
        if (_policyHash != null) msg = msg + 'Hash is ' + _policyHash + '   ';
        if (_owner != null)  msg = msg + 'Owner is ' + _owner + '   ';
        if (_info != null)  msg = msg + 'Info is ' + _info;
        console.log(msg);
    }
    console.log('================================================');
    for (let i=0; i<logs.length; i++){
        let hashPrint;
        let statePrint;
        let infoPrint;
        
        if (logs[i].args.policyHash == miscFunc.getEmptyHash()) {
            hashPrint =  '-            ';
            statePrint = '-            ';
            infoPrint = miscFunc.hexToAscii(logs[i].args.info, 22);
        }
        else {
            hashPrint = miscFunc.shortenHash(logs[i].args.policyHash);
            statePrint = policyState[logs[i].args.state.toNumber()];
            if (parseInt(logs[i].args.info) == 0)
                infoPrint = "                  -   "
            else if (parseInt(logs[i].args.info) < (Math.pow(10, 18)))
                infoPrint = miscFunc.formatNr(parseInt(logs[i].args.info), false, 22, false, true);
            else 
                infoPrint = '         ' + miscFunc.shortenHash(logs[i].args.info);
        }

        console.log(miscFunc.getLocalDateStringFromEpoch(logs[i].args.timestamp) + '   ' + 
            hashPrint + '   ' +
            statePrint + '   ' +
            infoPrint + '   ' + 
            logs[i].args.owner
            );
    }
    console.log('');
    console.log('');
}

//event LogAdjustor(bytes32 indexed adjustorHash, address indexed owner, bytes32 indexed info, uint timestamp);
exports.printAdjustorLogs = async (_adjustorHash, _owner, _info) => {
    // Retrieve all the logs
    const logs = await td.adjustor.getPastEvents('LogAdjustor', { 
        filter: { adjustorHash: _adjustorHash, owner: _owner, info: _info },
        fromBlock: blockNumberStart, 
        toBlock: "latest" 
    });

    // Print header
    console.log('');
    if ((_adjustorHash == null) && (_owner == null) && (_info == null))
        console.log('Adjustor: ' + '--- all logs ---');
    else {
        let msg = 'Adjustor: ';
        if (_adjustorHash != null) msg = msg + 'Hash is ' + _adjustorHash + '   ';
        if (_owner != null)  msg = msg + 'Owner is ' + _owner + '   ';
        if (_info != null)  msg = msg + 'Info is ' + _info;
        console.log(msg);
    }
    console.log('================================================');
    for (let i=0; i<logs.length; i++){
        let hashPrint;
        let infoPrint;
        
        if (parseInt(logs[i].args.adjustorHash) == 0) {
            hashPrint =  '-            ';
            infoPrint = miscFunc.hexToAscii(logs[i].args.info, 30);
        }
        else {
            hashPrint = miscFunc.shortenHash(logs[i].args.adjustorHash);
            if (parseInt(logs[i].args.info) == 0)
                infoPrint = "                  -   "
            else if (parseInt(logs[i].args.info) < (Math.pow(10, 18)))
                infoPrint = miscFunc.formatNr(parseInt(logs[i].args.info), true, 20, false, true);
            else 
                infoPrint = '         ' + miscFunc.shortenHash(logs[i].args.info);
        }

        console.log(miscFunc.getLocalDateStringFromEpoch(logs[i].args.timestamp) + '   ' + 
            hashPrint + '   ' +
            logs[i].args.owner  + '   ' +
            infoPrint
            );
    }
    console.log('');
    console.log('');
}

//event LogSettlement(bytes32 indexed settlementHash, bytes32 indexed adjustorHash, bytes32 indexed info, uint timestamp, uint state);
exports.printSettlementLogs = async (_settlementHash, _adjustorHash, _info) => {
    // Array to store the Settlement states
    let settlementState = [   'Created        ', 'Processing     ', 'Settled        ', '               '];
    
    // Retrieve all the logs
    const logs = await td.settlement.getPastEvents('LogSettlement', { 
        filter: { settlementHash: _settlementHash, adjustorHash: _adjustorHash, info: _info },
        fromBlock: blockNumberStart, 
        toBlock: "latest" 
    });
    
    // Print header
    console.log('');
    if ((_settlementHash == null) && (_adjustorHash == null) && (_info == null))
        console.log('Settlement: ' + '--- all logs ---');
    else {
        let msg = 'Settlement: ';
        if (_settlementHash != null) msg = msg + 'Settlement hash is ' + _settlementHash + '   ';
        if (_adjustorHash != null)  msg = msg + 'Adjustor hash is ' + _adjustorHash + '   ';
        if (_info != null)  msg = msg + 'Info is ' + _info;
        console.log(msg);
    }
    console.log('================================================');
    for (let i=0; i<logs.length; i++){
        let infoPrint;
        if (parseInt(logs[i].args.info) == 0)
            infoPrint = '-                             ';
        else if (logs[i].args.state.toNumber() == 0)
                infoPrint = 'Policy Hash:     ' + miscFunc.shortenHash(logs[i].args.info);
        else infoPrint = 'Document Hash:   ' + miscFunc.shortenHash(logs[i].args.info);
        
        console.log(miscFunc.getLocalDateStringFromEpoch(logs[i].args.timestamp) + '   ' + 
            miscFunc.shortenHash(logs[i].args.settlementHash) + '   ' +
            settlementState[logs[i].args.state.toNumber()] + '   ' + 
            infoPrint + '   ' +
            miscFunc.shortenHash(logs[i].args.adjustorHash)
            );
    }
    console.log('');
    console.log('');
}

exports.getPremiumDay = function(_day) {
    let printStr = miscFunc.formatNr(_day, false, 15, false, false) + "  |  ";
    return td.policy.premiumPerRiskPoint_Cu_Ppm.call(_day, 0)
    .then(function(res) {
        printStr = printStr + miscFunc.formatNr(res.toNumber(), false, 15, false, true);
        return td.policy.premiumPerRiskPoint_Cu_Ppm.call(_day, 1);
    })
    .then(function(res) {
        printStr = printStr + miscFunc.formatNr(res.toNumber(), false, 15, false, true);
        return td.policy.premiumPerRiskPoint_Cu_Ppm.call(_day, 2);
    })
    .then(function(res) {
        printStr = printStr + miscFunc.formatNr(res.toNumber(), false, 15, false, true);
        return td.policy.premiumPerRiskPoint_Cu_Ppm.call(_day, 3);
    })
    .then(function(res) {
        printStr = printStr + miscFunc.formatNr(res.toNumber(), false, 15, false, true);
        return td.policy.premiumPerRiskPoint_Cu_Ppm.call(_day, 4);
    })
    .then(function(res) {
        printStr = printStr + miscFunc.formatNr(res.toNumber(), false, 15, false, true);
        return printStr;
    });
}

exports.getPremiumDay = async (_day, _count) => {
    let printStr = miscFunc.formatNr(_day, false, 10, false, false) + "| ";
    for (let i=0; i<_count; i++) {
        printStr = printStr + miscFunc.formatNr((await td.policy.premiumPerRiskPoint_Cu_Ppm(_day, i)).toNumber(), false, 15, false, true);
    }
    return printStr;
}

exports.printPremiums = async (_count) => {
    let day = td.currentPoolDay;
    let header    = "   Day    |";
    let subHeader = "----------|";
    for (let i=0; i<_count; i++) {
        header = header + miscFunc.formatNr(i, false, 15, false, false);
        subHeader = subHeader + "---------------"
    }
    // Print header
    console.log('');
    console.log(header); 
    console.log(subHeader);
    // Print the premiums
    for (let i=0; i<_count; i++) {
        day--;
        console.log(await printLogFiles.getPremiumDay(day, _count));
    }
    console.log('');
}