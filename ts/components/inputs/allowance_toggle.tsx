import * as _ from 'lodash';
import * as React from 'react';
import {ZeroEx} from '@0xproject/0x.js';
import * as BigNumber from 'bignumber.js';
import Toggle from 'material-ui/Toggle';
import {Blockchain} from 'ts/blockchain';
import {Dispatcher} from 'ts/redux/dispatcher';
import {Token, BalanceErrs} from 'ts/types';
import {utils} from 'ts/utils/utils';
import {errorReporter} from 'ts/utils/error_reporter';

const DEFAULT_ALLOWANCE_AMOUNT_IN_UNITS = 1000000;

interface AllowanceToggleProps {
    blockchain: Blockchain;
    dispatcher: Dispatcher;
    onErrorOccurred: (errType: BalanceErrs) => void;
    token: Token;
    userAddress: string;
}

interface AllowanceToggleState {
    isSpinnerVisible: boolean;
    prevAllowance: BigNumber.BigNumber;
}

export class AllowanceToggle extends React.Component<AllowanceToggleProps, AllowanceToggleState> {
    constructor(props: AllowanceToggleProps) {
        super(props);
        this.state = {
            isSpinnerVisible: false,
            prevAllowance: props.token.allowance,
        };
    }
    public componentWillReceiveProps(nextProps: AllowanceToggleProps) {
        if (!nextProps.token.allowance.eq(this.state.prevAllowance)) {
            this.setState({
                isSpinnerVisible: false,
                prevAllowance: nextProps.token.allowance,
            });
        }
    }
    public render() {
        return (
            <div className="flex">
                <div>
                    <Toggle
                        disabled={this.state.isSpinnerVisible}
                        toggled={this.isAllowanceSet()}
                        onToggle={this.onToggleAllowanceAsync.bind(this, this.props.token)}
                    />
                </div>
                {this.state.isSpinnerVisible &&
                    <div className="pl1" style={{paddingTop: 3}}>
                        <i className="zmdi zmdi-spinner zmdi-hc-spin" />
                    </div>
                }
            </div>
        );
    }
    private async onToggleAllowanceAsync() {
        if (this.props.userAddress === '') {
            this.props.dispatcher.updateShouldBlockchainErrDialogBeOpen(true);
            return false;
        }

        this.setState({
            isSpinnerVisible: true,
        });

        let newAllowanceAmountInUnits = 0;
        if (!this.isAllowanceSet()) {
            newAllowanceAmountInUnits = DEFAULT_ALLOWANCE_AMOUNT_IN_UNITS;
        }
        try {
            const allowanceInUnits = new BigNumber(newAllowanceAmountInUnits);
            const amountInBaseUnits = ZeroEx.toBaseUnitAmount(allowanceInUnits, this.props.token.decimals);
            await this.props.blockchain.setExchangeAllowanceAsync(this.props.token, amountInBaseUnits);
        } catch (err) {
            this.setState({
                isSpinnerVisible: false,
            });
            const errMsg = '' + err;
            if (_.includes(errMsg, 'User denied transaction')) {
                return false;
            }
            utils.consoleLog(`Unexpected error encountered: ${err}`);
            utils.consoleLog(err.stack);
            await errorReporter.reportAsync(err);
            this.props.onErrorOccurred(BalanceErrs.allowanceSettingFailed);
        }
    }
    private isAllowanceSet() {
        const token = this.props.token;
        const allowanceInUnits = ZeroEx.toUnitAmount(token.allowance, token.decimals);
        return !allowanceInUnits.eq(0);
    }
}
