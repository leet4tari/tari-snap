import { useContext, useEffect } from 'react';
import { MetamaskActions, MetaMaskContext, TariActions, TariContext, AccountState } from '../hooks';

import {
    connectSnap,
    getSnap,
    getTariWalletToken,
    isLocalSnap,
    sendWalletRequest,
    setTariWallet,
    shouldDisplayReconnectButton,
} from '../utils';
import {
    ConnectButton,
    InstallFlaskButton,
    ReconnectButton,
    Card,
    ThemeButton,
} from '../components';
import { defaultSnapOrigin } from '../config';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import React from 'react';
import { SendDialog } from '../components/SendDialog';
import { ReceiveDialog } from '../components/ReceiveDialog';

function Balances() {
    const [metamaskState, metamaskDispatch] = useContext(MetaMaskContext);
    const [tari, tariDispatch] = useContext(TariContext);

    const [sendDialogOpen, setSendDialogOpen] = React.useState(false);
    const [receiveDialogOpen, setReceiveDialogOpen] = React.useState(false);

    const getAccount = async () => {
        try {
            const walletRequest = {
                method: 'accounts.get_default',
                params: {}
            };

            const account = await sendWalletRequest(tari.token, walletRequest);
            return account
        } catch (e) {
            console.error(e);
            metamaskDispatch({ type: MetamaskActions.SetError, payload: e });
            return null;
        }
    };

    const getBalances = async () => {
        try {
            if (!tari || !tari.account || !tari.account.address) {
                return [];
            }
            const walletRequest = {
                method: 'accounts.get_balances',
                params: {
                    account: tari.account.address,
                    refresh: true,
                }
            };

            const response = await sendWalletRequest(tari.token, walletRequest);
            return response.balances;
        } catch (e) {
            console.error(e);
            metamaskDispatch({ type: MetamaskActions.SetError, payload: e });
            return [];
        }
    };

    const refreshAccountData = async () => {
        const accountData = await getAccount();
        if (accountData) {
            const payload: AccountState = {
                name: accountData.account.name,
                address: accountData.account.address.Component,
                public_key: accountData.public_key,
            };

            tariDispatch({
                type: TariActions.SetAccount,
                payload,
            });

            refreshAccountBalances();
        }
    }

    const refreshAccountBalances = async () => {
        const raw_balances = await getBalances();
        let balances = raw_balances.map(b => { return ({ name: b.token_symbol || "Tari", address: b.resource_address, balance: b.balance }); });
        if (balances.length > 0) {
            tariDispatch({
                type: TariActions.SetBalances,
                payload: balances,
            });
        }

        // we keep polling for balances to keep them updated
        setTimeout(async () => { await refreshAccountBalances() }, 4000);
    }

    useEffect(() => {
        if (tari.token) {
            refreshAccountData();
        }
    }, [tari.token]);

    useEffect(() => {
        refreshAccountBalances();
    }, [tari.account]);

    const handleCopyClick = async (text: string | undefined) => {
        navigator.clipboard.writeText(text || '');
    };

    const handleSendDialogClickOpen = () => {
        setSendDialogOpen(true);
    };

    const handleSendDialogClose = () => {
        setSendDialogOpen(false);
    };

    const handleSendDialogSend = (token: string, amount: number, recipientAddress: string) => {
        setSendDialogOpen(false);
    };

    const handleReceiveDialogClickOpen = () => {
        setReceiveDialogOpen(true);
    };

    const handleReceiveDialogClose = () => {
        setReceiveDialogOpen(false);
    };

    return (
        <Container>
            {tari.account?.public_key ?
                (<Container>
                    <Paper variant="outlined" elevation={0} sx={{ mt: 4, padding: 2, paddingLeft: 4, paddingRight: 4, borderRadius: 4 }}>
                        <Stack direction="row" justifyContent="space-between" spacing={2}>
                            <Box>
                                <Typography style={{ fontSize: 12 }} >
                                    {tari.account?.name}
                                </Typography>
                                <Stack direction="row" alignItems="center" justifyContent="center">
                                    <Typography style={{ fontSize: 15 }} >
                                        {tari.account?.public_key}
                                    </Typography>
                                    <IconButton aria-label="copy" onClick={() => handleCopyClick(tari.account?.public_key)}>
                                        <ContentCopyIcon />
                                    </IconButton>
                                </Stack>
                            </Box>
                            <Stack direction="row" spacing={2}>
                                <ThemeButton text="Receive" onClick={handleReceiveDialogClickOpen}/>
                                <ThemeButton text="Send" onClick={handleSendDialogClickOpen}/>
                            </Stack>
                        </Stack>
        
                    </Paper>
                    <Paper variant="outlined" elevation={0} sx={{ mt: 4, padding: 2, paddingLeft: 4, paddingRight: 4, borderRadius: 4 }}>
                        <Stack direction="column" justifyContent="flex-start" spacing={2}>
                            <Typography style={{ fontSize: 24 }} >
                                Balances
                            </Typography>
                        </Stack>
                        <Table sx={{ minWidth: 650 }} aria-label="simple table">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontSize: 14 }}>Name</TableCell>
                                    <TableCell sx={{ fontSize: 14 }}>Resource Address</TableCell>
                                    <TableCell sx={{ fontSize: 14 }}>Balance</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {
                                    tari.balances.map((token) => (
                                        <TableRow
                                            key={token.name}
                                            sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                        >
                                            <TableCell component="th" scope="row" sx={{ fontSize: 14 }}>
                                                {token.name}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: 14 }}>{token.address}</TableCell>
                                            <TableCell sx={{ fontSize: 14 }}> {token.balance}</TableCell>
                                        </TableRow>
                                    ))
                                }
                            </TableBody>
                        </Table>
                    </Paper>
                    <SendDialog
                        open={sendDialogOpen}
                        onSend={handleSendDialogSend}
                        onClose={handleSendDialogClose}
                        accountBalances={tari.balances}
                    />
                    <ReceiveDialog
                        address={tari.account?.public_key}
                        open={receiveDialogOpen}
                        onClose={handleReceiveDialogClose}
                    />
                </Container>) 
                : (<div/>) }
        </Container>
    );
}

export default Balances;