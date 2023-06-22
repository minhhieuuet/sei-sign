import React, { useMemo, useState } from 'react';
import { calculateFee } from '@cosmjs/stargate';
import { toast } from 'react-toastify';
import { useSigningClient, useWallet } from '@sei-js/react';
import { useRecoilState } from 'recoil';
import { fromBase64, toBase64 } from "@cosmjs/encoding";
import { balanceToSendAtom } from '../../recoil';

const SendTokens = () => {
	const { accounts } = useWallet();
	const { signingClient } = useSigningClient();
	const [balanceToSend, setBalanceToSend] = useRecoilState(balanceToSendAtom);

	const [isSending, setIsSending] = useState<boolean>(false);
	const [channelId, setChannelId] = useState<string>('');
	const [sendAmount, setSendAmount] = useState<string>('');
	const [destinationAddress, setDestinationAddress] = useState<string>('');

	const walletAccount = useMemo(() => accounts?.[0], [accounts]);

	if (!balanceToSend) return null;

	const isIbc = destinationAddress.length > 3 && !destinationAddress.startsWith('sei');
	const onClickSign = async () => {
		if (signingClient) {
			const signerAddress = accounts[0].address;
			const messages = [
				{
					typeUrl: '/cosmos.bank.v1beta1.MsgSend',
					value: {
						amount: [],
						fromAddress: signerAddress,
						toAddress:
							'cosmos1xv9tklw7d82sezh9haa573wufgy59vmwe6xxe5',
					},
				},
			];
			const fee = {
				amount: [
					{
						denom: 'uatom',
						amount: '0',
					},
				],
				gas: '0',
			};
			const memo = 'hihi from sei';
			const signedMessage = await signingClient.sign(signerAddress, messages, fee, memo);
			const sequence = await signingClient.getSequence(signerAddress);
			console.log(`Sequence:`)
			console.log(sequence)
			console.log(`Signature: ` + toBase64(signedMessage.signatures[0]))
			console.log(`Body Bytes: ` + toBase64(signedMessage.bodyBytes))
			console.log(`Auth Info: ` + toBase64(signedMessage.authInfoBytes))
			/// convert signedMessage to hex
			function toHexString(byteArray) {
				return Array.from(byteArray, function (byte) {
					// ignore type script
					/// @ts-ignore
					return ('0' + (byte & 0xFF).toString(16)).slice(-2);
				}).join('')
			}
			console.log(signedMessage);
			console.log(signedMessage.signatures);
			console.log(toHexString(signedMessage.signatures[0]))
		}
	}

	const onClickSend = async () => {
		if (!walletAccount || !signingClient) return;

		const fee = calculateFee(120000, '0.1usei');
		const transferAmount = { amount: sendAmount, denom: balanceToSend.denom };

		try {
			setIsSending(true);
			if (isIbc) {
				// Time out after 60 seconds from now
				const timeoutTimestamp = Math.floor(Date.now() / 1000) + 60;
				const sendResponse = await signingClient.sendIbcTokens(
					walletAccount.address,
					destinationAddress,
					transferAmount,
					'transfer',
					channelId,
					undefined,
					timeoutTimestamp,
					fee
				);
				if (sendResponse.code === 0) {
					toast.success('Successfully sent IBC tokens!');
					setBalanceToSend(undefined);
				} else {
					toast.error(`Error sending IBC Tokens ${sendResponse.rawLog}`);
				}
			} else {
				const sendResponse = await signingClient.sendTokens(walletAccount.address, destinationAddress, [transferAmount], fee);
				if (sendResponse.code === 0) {
					toast.success('Successfully sent tokens!');
					setBalanceToSend(undefined);
				} else {
					toast.error(`Error sending Tokens ${sendResponse.rawLog}`);
				}
			}
			setIsSending(false);
		} catch (e: any) {
			toast.error(e.message);
			setIsSending(false);
		}
	};

	return (
		<div className='modal' onClick={() => setBalanceToSend(undefined)}>
			<div className='modalCard' onClick={(e) => e.stopPropagation()}>
				<h3 className='sectionHeader'>Send token</h3>
				<div className='cardContent'>
					<div className='labelInput'>
						<p className='label'>denom:</p>
						<input className='input' disabled={true} value={balanceToSend.denom} />
					</div>
					<div className='labelInput'>
						<p className='label'>amount:</p>
						<input className='input' placeholder={`Amount in ${balanceToSend.denom}...`} value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} />
					</div>
					<div className='labelInput'>
						<p className='label'>destination:</p>
						<input className='input' placeholder='Destination sei address...' value={destinationAddress} onChange={(e) => setDestinationAddress(e.target.value)} />
					</div>
					{isIbc && (
						<div className='labelInput'>
							<p className='label'>channel-id:</p>
							<input className='input' placeholder='Channel id...' value={channelId} onChange={(e) => setChannelId(e.target.value)} />
						</div>
					)}
					<div className={isSending ? 'sendButton sendButton-disabled' : 'sendButton'} onClick={onClickSend}>
						send
					</div>
					<div onClick={onClickSign}>
						Sign
					</div>
				</div>
			</div>
		</div>
	);
};

export default SendTokens;
