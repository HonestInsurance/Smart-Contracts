[<img src="https://github.com/HonestInsurance/Resources/blob/master/branding/HonestInsurance-blue.png?raw=true" width="250">](https://www.honestinsurance.net)

-----------------------

## Overview

The smart contracts in this repository provide an ecosystem to operate a self-governing, subscription-based, people-to-people insurance service. To achieve this, **insurance pools** are formed. Each pool represents a group of people who chose to form an insurance community and engage in this service. Alternatively, an insurance pool can be created specifically to support an existing community who would like to offer an insurance service to its members.

Possible examples of insurance pools are:
* New Hampshire Car Insurance 
* Home and Contents Insurance for IBM employees
* CrossFit Health Insurance
* Professional Indemnity Insurance for independent contractors

Each insurance pool community is run and operated independently from one another. This model is currency agnostic and can be operated Fiat as well as Crypto currency. Further information and a detailed description of the mathematical functioning of this model can be accessed in this [white paper](https://github.com/HonestInsurance/Resources/blob/master/research/WhitePaper-HonestInsurance.pdf?raw=true).

**Self-Governing**

On a daily basis, this model assesses the insurance pool's historic operating expenses, its current number of policy holders and calculates the ideal insurance premium to be charged for the next day.

**Subscription-based**

Since the policy premiums are charged on a daily basis, each insurance consumer is able to 'pause' coverage for a number of days and/or retire an insurance policy any time.

**People-to-People**

The reasoning for not calling this model 'peer-to-peer' is because peer-to-peer insurance assumes that the insurance consumers are providing as well as receiving insurance cover to each other at the same time. In this model, the 'first layer' of insurance is provided by the Liquidity Providers (via purchasing bonds that provide the pool with liquidity). Hence, the notion of People-to-People.

-----------------------

## The stakeholders of an insurance pool

This model necessitates the engagement of the stakeholders listed below.


| Stakeholder             | Description                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Consumers**           | Individuals who want to receive the insurance service                                                                                                                     |
| **Liquidity Providers** | Provide capital (by purchasing bonds) in exchange for receiving back their principal plus yield when the bond matures                                                     |
| **Pool Operators**      | An organization that is responsible for running the day to day operations of the insurance ecosystem                                                                      |
| **Trust (Mutual)**      | The 'owners' and representatives of an insurance pool from a legal perspective. The trust or mutual (as the name suggests) should be a set up as a not-for-profit entity. |
| **Adjustors**           | Assess and make decisions about the insurance pool's claims (which are called settlements in this model)                                                                  |
| **Service Providers**   | Provide the services to the insurance pool's consumers                                                                                                                    |

The diagram below illustrates the relationship between these stakeholders and the flow of funds between them.

<img src="https://github.com/HonestInsurance/Resources/blob/master/diagrams/InsuranceModel.png?raw=true" width="600">

Each arrow in this diagram represents a flow of funds (currency). For this insurance model to function three currency accounts called
* Premium Holding Account
* Bond Holding Account and
* Funding Account 
 
are required. These can be either traditional checking accounts denominated in Fiat currency or three crypto currency addresses 'providing' the necessary banking services.

The funds in the `Funding Account` are used to pay for the insurance services the insurance consumers are receiving. When additional demand of liquidity is required (i.e. the balance of the funding account has become too low), liquidity providers are able to contribute funds by purchasing bonds. In this case the liquidity providers transfer the bond principal amount to the `Funding Account`.

When a bond matures, the bond's principal plus yield are paid back to the liquidity provider using the `Bond Holding Account`. It is the task of the insurance pool contract to ensure the `Bond Holding Account` remains sufficiently funded to settle current and future maturing bonds.

Lastly, insurance consumers deposit the premiums in to the `Premium Holding Account`. The purpose of this account - as the name suggests - is only to temporarily hold the consumer's premium while it is consumed little by little on a daily basis. Put another way, all the funds in this account are still owned by the insurance consumers. Hence, an insurance consumer can choose the premium payment frequency as well as the payment amount, provided that her balance remains positive (otherwise her policy would lapse). On a daily basis, the total combined premium amount for all insurance consumers (and their active policies) is calculated and a single bank transaction from the `Premium Holding Account` to the `Bond Holding Account` is executed.

-----------------------

## Looking under the hood

A running instance of an insurance ecosystem requires the following nine smart contracts to be deployed and initialized on an Ethereum Virtual Machine (EVM) powered Blockchain. No additional contracts are created during the operation of the insurance service. The remaining contracts not mentioned in the list below are interface or abstract contracts or contracts used for testing and deployment purposes.
* Lib
* Trust
* Pool
* Bank
* Timer
* Adjustor 
* Policy
* Settlement
* Bond

In the sections following, a selected few event log files are presented and explained more in detail. These were generated by running the test script `test.js`

### Pool

The pool contract is the centrepiece of this ecosystem as it contains the core logic required for the pool to be self-governing. The log files below are generated each day presenting the most important variables that were re-calculated during the overnight processing. The first column displays the date this log file was created. The second column is the event log's subject while the third column holds the corresponding value. The fourth column refers to the 'current day' (days since 1/1/1970) the pool is currently in.

```
...
2018-02-05 00:00:00   WcExpenseForecastCu            $        14,000.00             17567
2018-02-05 00:00:00   WcBondCu                       $        12,187.67             17567
2018-02-05 00:00:00   BondGradientPpq                     18,755,016                17567
2018-02-05 00:00:00   BondYieldPpb                        22,857,995                17567
2018-02-05 00:00:00   BondPayoutNext3DaysCu                           -             17567
2018-02-05 00:00:00   BondPayoutFutureCu             $           793.66             17567
2018-02-05 00:00:00   PremiumPerRiskPointPpm              66,138,333                17567
2018-02-06 00:00:00   TotalRiskPoints                          1,200                17567
2018-02-06 00:00:00   PremiumCu                      $           793.65             17567
...
```

The entry `WcExpenseForecastCu` states a value of $ 14,000.00 and is calculated by using the insurance pool's historic expenses. This expense forecast is then used as an input variable to calculate the value for `WcBondCu` of $ 12,187.67 which is then offered to the liquidity providers to purchase bonds. `BondGradientPpq` and `BondYieldPpb` describe the yield at which these bonds can be purchased (e.g. the specified yield value of 22,857,995 equates to 2.2857995%). The two `BondPayout` entries state the total value of bonds that mature within the next three days and in the future (averaged per day) respectively.

`PremiumPerRiskPointPpm` represents one of the most important variables that is calculated every night and defines the premium amount per risk point each policy is 'charged' for the day of 17567. `TotalRiskPoints` states the combined risk point value of all the policies that were active today. By multiplying `TotalRiskPoints` with `PremiumPerRiskPointPpm` today's premium is calculated. `66,138,333 * 1,200 / 1,000,000 = 79365.9996 cents` which is the equivalent of **$ 793.65** (Note: The value of `PremiumPerRiskPointPpm` is stored in `Ppm` (parts per million) hence the division by `1,000,000`). This premium amount of **$ 793.65** is then debited from the `Premium Holding Account` and credited to the `Bond Holding Account`.

### Bond

The bond contract holds the data about all current and matured bonds. Below all the available log files are displayed for a single bond (uniquely identified by its hash value). The second column shows the bond's hash (abbreviated here) while the fifth column shows the bond owner's address (also displayed abbreviated). The third column indicates the state the bond was in when the log file was added while the fourth column displays further details about this bond.

```
Bond Hash: 0x9a9a7136ef13d3ea22b710119e7a1d1075a1cdef8355ee41d726096cea727cd1
=============================================================================
2018-01-18 08:35:02   0x9a9a...7cd1   Created                  $            250.00   0xf17f52151e...
2018-01-18 08:35:02   0x9a9a...7cd1   SecuredBondPrincipal     $            250.00   0xf17f52151e...
2018-01-18 08:35:02   0x9a9a...7cd1   Signed                          5,000,000      0xf17f52151e...
2018-01-18 08:35:02   0x9a9a...7cd1   Issued                   2018-04-18 07:35:00   0xf17f52151e...
2018-01-22 08:35:03   0x9a9a...7cd1   LockedReferenceBond            0x87e6...8ea8   0xf17f52151e...
2018-01-22 08:35:03   0x9a9a...7cd1   Issued                   2018-04-18 07:35:00   0xf17f52151e...
2018-04-18 07:35:00   0x9a9a...7cd1   Matured                  $            251.25   0xf17f52151e...
```

The log files of the bond above show that this bond was created on 2018-01-18 08:35:02 with a requested bond principal of $ 250.00. The bond was finally signed by the pool with a promised bond yield of 5,000,000 (which translates into 0.5%) and is scheduled to mature 3 months later on 2018-04-18 07:35:00. This bond was also used to be a reference for another bond with the bond hash of 0x87e6...8ea8 before it returned its state back to Issued. Lastly, the bond matured on 2018-04-18 07:35:00 and the bond's principal and yield were paid back to the liquidity provider (principal of $ 250.00 plus the yield of $ 250.00 * 0.005 equals the pay-out amount of $ 251.25).

The diagram below shows the states and life-cycle of a bond in this ecosystem.
<img src="https://github.com/HonestInsurance/Resources/blob/master/diagrams/BondStates.png?raw=true" width="700">

### Policy

The policy contract contains all the policy related information on all the policies that are managed by this insurance pool. The second column shows the policy's hash (only abbreviated) while the fifth column shows the policy owner's address. The third column indicates the state the policy was in when the log file was added while the fourth column displays further details about this policy.

```
Policy Hash: 0x22305bcf99b225e25ca70db8c1caa426b058e558c14d399113fbf9e0de04cee7
===============================================================================
2018-01-18 08:35:04   0x2230...cee7   Paused                 10      0xd77216b732...
2018-01-18 08:35:04   0x2230...cee7   Paused         0xa869...a876   0xd77216b732...
2018-01-18 08:35:04   0x2230...cee7   Issued                  -      0xd77216b732...
2018-02-13 08:35:02   0x2230...cee7   Retired                 -      0xd77216b732...
```

This policy was created on 2018-01-18 08:35:04 with the policy document's hash of 0xa869...a876 and 10 risk points associated with it. The policy was issued on the 2018-01-18 08:35:04 and was finally retired on 2018-02-13 08:35:02. By taking the log files of the pool as shown earlier into consideration and looking at the log entry called `PremiumPerRiskPointPpm` we can see a value of `66,138,333`. Multiplying this value with this policy's risk points we get the premium this policy was charged on this particular day `66,138,333 * 10 / 1,000,000 = 661.38 cent` which is the equivalent of **$ 6.6138** (Note: The Value of `PremiumPerRiskPointPpm` is stored in `Ppm` (parts per million) hence the division by `1,000,000`)

The diagram below shows the states and life-cycle of a policy in this ecosystem.

<img src="https://github.com/HonestInsurance/Resources/blob/master/diagrams/PolicyStates.png?raw=true" width="550">

### Adjustor

The second column in the adjustor log files below display the hash of this adjustor and the third column shows the adjustor's public key. The fourth column shows further adjustor relevant information.

```
Adjustor Hash: 0x07f3cce2be8998b63dcbd54347160db978952f063677b3e2cc44762ec5d586b1
=================================================================================
2018-01-17 14:44:57   0x07f3...86b1   0xf17f52151ebef6c7334fad080c5704d77216b732   $      250,000.00
2018-01-17 14:44:57   0x07f3...86b1   0xf17f52151ebef6c7334fad080c5704d77216b732                2000
2018-01-17 14:44:57   0x07f3...86b1   0xf17f52151ebef6c7334fad080c5704d77216b732       0xf142...e72e
```

This adjustor is authorised to process settlements (claims) of up to a total value of $ 250,000.00 and on-board policies with a policy risk point value of up to 2,000 risk points. The hash value displayed `0xf142...e72e` is the hash of the adjustor service agreement between this adjustor and the insurance pool.

### Settlement

The reason for calling this a settlement contract (as opposed to claim contract) is that it's possible that some of the consumer-related expenditures may not be the result of a claim. As an example, a health insurance provider might employ health coaches to assist their consumer base to live a healthier lifestyle. The term 'settlement' is therefore better suited to describe expenses that occur as a result of servicing consumers (with the additional benefit of having a more positive association compared to the word claim).

The second column in the settlement log files below show the unique hash of the settlement while the third column shows its status. The fourth column displays the hash of the policy this settlement refers to as well as any additional hashes of documents that were created in the processing of this settlement. The last column shows the hash of the adjustor processing this settlement. Note: The final settlement amount is stored in the `Settlement.sol` contract itself and not shown in the log files.

```
Settlement Hash: 0xd361db77a4531d375bf7107ab03dbdea239bb5e12f3b85b5d8d49a6d9bdee6f4
===================================================================================
2018-01-28 08:35:02   0xd361...e6f4   Created        Policy Hash:     0x2230...cee7   0x07f3...86b1
2018-01-28 08:35:02   0xd361...e6f4   Processing     Document Hash:   0xef7d...98c6   0x07f3...86b1
2018-01-28 08:35:02   0xd361...e6f4   Settled        Document Hash:   0x4bd5...b143   0x07f3...86b1
```

-----------------------

## Test Execution

The output of running the `test.js` test script is presented below. Due to the number of asserts (checks) performed (about 2,300) in the 69 unit-test below the entire test script requires about 40 seconds to complete (hardware used is latest model of MacBook Pro).

```
truffle(develop)> test test/test.js
Using network 'develop'.

Contract: All Insurance Ecosystem Contracts
    ✓ should verify and save the initialisation variables of Pool
    ✓ should create adjustor 1 [owner: 1]
    ✓ should create adjustor 2 [owner: 2]
    ✓ should create adjustor 3 [owner: 3]
    ✓ should create adjustor 4 [owner: 4]
    ✓ should update adjustor 4 [owner: 4]
    ✓ should retire adjustor 4 [owner: 4]
    ✓ should run all overnight processing tasks
    ✓ should change the pool daylight saving time
    ✓ should create bond 1 [owner: 1] (SecuredBondPrincipal)
    ✓ should credit bond 1 [owner: 1] principal amount to Funding account (SecuredBondPrincipal)
    ✓ should accelerate the Pool Yield by 48 intervals (2 days)
    ✓ should create bond 2 [owner: 2] (SecuredBondPrincipal) and credit principal
    ✓ should create policy 1 [owner: 1], adjustor 1
    ✓ should credit policy 1 [owner: 1] premium to Premium Holding Account account
    ✓ should create policy 2 [owner: 2], adjustor 1 and credit premium
    ✓ should run all overnight processing tasks
    ✓ should run all overnight processing tasks
    ✓ should run all overnight processing tasks
    ✓ should run all overnight processing tasks
    ✓ should accelerate the Pool Yield by 48 intervals (2 days) 
    ✓ should create bond 3 [owner: 1] (SecuredReferenceBond [bond: 1]) and credit principal
    ✓ should mature bond 1 [owner: 1] and process as matured 
    ✓ should create bond 4 [owner: 1] (SecuredReferenceBond [bond: 3]) 
    ✓ should mature bond 3 [owner: 1] and process as defaulted 
    ✓ should mature bond 4 [owner: 1] and process as defaulted 
    ✓ should create bond 5 [owner: 5] (SecuredBondPrincipal) 
    ✓ should mature bond 5 [owner: 5] and process as defaulted 
    ✓ should process all outstanding bank payment advice 
    ✓ should run all overnight processing tasks
    ✓ should run all overnight processing tasks
    ✓ should run all overnight processing tasks
    ✓ should run all overnight processing tasks
    ✓ should run all overnight processing tasks
    ✓ should run all overnight processing tasks
    ✓ should create settlement 1 [adjustor: 2] 
    ✓ should create settlement 2 [adjustor: 2] 
    ✓ should add additional info to settlement 2 [adjustor: 2] 
    ✓ should add additional info to settlement 2 [adjustor: 2] 
    ✓ should set expected settlement amount for settlement 1 [adjustor: 2] 
    ✓ should set expected settlement amount for settlement 1 [adjustor: 2] 
    ✓ should set expected settlement amount for settlement 2 [adjustor: 2] 
    ✓ should set expected settlement amount for settlement 2 [adjustor: 2] 
    ✓ should close settlement 1 [adjustor: 2] 
    ✓ should close settlement 2 [adjustor: 2]
    ✓ should process all outstanding bank payment advice 
    ✓ should run all overnight processing tasks
    ✓ should create policy 3 [owner: 3], adjustor 1 and credit premium
    ✓ should run all overnight processing tasks
    ✓ should run all overnight processing tasks
    ✓ should update policy 3 [owner: 3], adjustor 1 
    ✓ should run all overnight processing tasks
    ✓ should suspend policy 3 [owner: 3] 
    ✓ should run all overnight processing tasks
    ✓ should update policy 3 [owner: 3], adjustor 1 
    ✓ should unsuspend policy 3 [owner: 3] 
    ✓ should update policy 3 [owner: 3], adjustor 1 
    ✓ should run all overnight processing tasks
    ✓ should retire policy 3 [owner: 3] 
    ✓ should retire policy 1 [owner: 1] 
    ✓ should run all overnight processing tasks
    ✓ should create policy 4 [owner: 4], adjustor 1
    ✓ should run all overnight processing tasks
    ✓ should run all overnight processing tasks
    ✓ should credit policy 4 [owner: 4] premium to Premium Holding Account account
    ✓ should run all overnight processing tasks
    ✓ should change the pool daylight saving time
    ✓ should run all overnight processing tasks

  69 passing (34s)
```

The three tests below are verifying the interface contracts `ExtAccessI`, `IntAccessI` and the `HashMapI`. The library `Lib` contract does not require testing as its functions are tested via the `HashMapI` contract. `HashMapITest` is only used as an intermediary contract to test the `HashMapI` contract functions. `SetupI` does not need to be tested as it only contains the initialisation parameters (constants) for the insurance pool ecosystem. Lastly, `NotificaitonI` is a contract with only one abstract function that does not need to be tested either.

```
truffle(develop)> test test/component-tests/extAccessI.js
Using network 'develop'.

  Contract: ExtAccessI
    ✓ should deploy a new ExtAccessI contract and verify initialization variables
    ✓ should add key 1 with transaction submitted by key 0
    ✓ should add key 2 with transaction submitted by key 1
    ✓ should perform pre-authorisation with key 1, add key 3 with transaction submitted by key 2
    ✓ should do pre-auth with key 1, then pre-auth with key 2, add key 4 submitted by key 1
    ✓ should do pre-auth with key 3 and a key rotation transaction submitted by key 4
    ✓ should do pre-auth with key in key slot 1 and add key 5 transaction submitted by key slot 3

  7 passing (1s)
```

```
truffle(develop)> test test/component-tests/intAccessI.js
Using network 'develop'.

  Contract: IntAccessI
    ✓ should deploy a new IntAccessI contract and verify initialization variables
    ✓ should set and verify the remaining IntAccessI contract addresses

  2 passing (184ms)
```

```
truffle(develop)> test test/component-tests/hashMap.js
Using network 'develop'.

  Contract: HashMapI
    ✓ should deploy library and HashMapI contract and verify initialisation variables
    ✓ should add hash 1
    ✓ should add hash 2
    ✓ should add hash 3
    ✓ should archive hash 2
    ✓ should archive hash 1
    ✓ should archive hash 3

  7 passing (4s)
```

-----------------------

## Gratitude

This insurance model and its corresponding smart contracts are written in the Solidity programming language intended to be deployed on the Ethereum ecosystem. All the test code and deployment scripts are written in JavaScript. For the development of this solution the developer tools [Visual Studio Code](https://code.visualstudio.com/), Testrpc and [Truffle](http://truffleframework.com) were used. Thank you to everyone involved in building these amazing tools - you are true heroes my books!). And of course, a huge thank you to the Core Devs for giving us Ethereum!

-----------------------

## License

GPL-3.0