import { cssBundleHref } from '@remix-run/css-bundle';
import type { LinksFunction, LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import {
	Link,
	Links,
	LiveReload,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useRouteLoaderData,
} from '@remix-run/react';
import { z } from 'zod';
import tailwindCss from '~/global.css';
import { getOptionalUser } from './auth.server.ts';
import { Navigation } from './components/Navigation.tsx';
import { buttonVariants } from './components/ui/button.tsx';
import { SocketProvider, useSocket } from './hooks/useSocket.tsx';
import { IncomingCallModal } from './components/IncomingCallModal.tsx';
import { useState, useEffect } from 'react';
const envSchema = z.object({
	// BACKEND_URL: z.string(),
	WEBSOCKET_URL: z.string(),
	BACKEND_URL: z.string(), // Ajout de BACKEND_URL
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
	try {
		const user = await getOptionalUser({ request });
		const env = envSchema.parse({
			WEBSOCKET_URL: process.env.WEBSOCKET_URL ?? 'https://chat-module-2.onrender.com',
			BACKEND_URL: process.env.BACKEND_URL ?? 'https://chat-module-2.onrender.com',
		});
		return json({ user, env });
	} catch (error) {
		console.error('Root loader error:', error);
		return json({ user: null, env: null, error: 'Configuration error' }, { status: 500 });
	}
};


export const useOptionalUser = () => {
	const data = useRouteLoaderData<typeof loader>('root');
	if (data?.user) {
		return data.user;
	}
	return null;
};

export const useEnv = () => {
	const data = useRouteLoaderData<typeof loader>('root');
	if (data?.env) {
		return data.env;
	}
	throw new Error("L'objet ENV n'existe pas");
};

export const useUser = () => {
	const data = useRouteLoaderData<typeof loader>('root');
	if (!data?.user) {
		throw new Error("L'utilisateur n'est pas identifié.");
	}
	return data.user;
};

export const links: LinksFunction = () => [
	{ rel: 'preconnect', as: 'style', href: tailwindCss },
	{ rel: 'stylesheet', href: tailwindCss },
	...(cssBundleHref ? [{ rel: 'stylesheet', href: cssBundleHref }] : []),
];

export default function App() {
	const user = useOptionalUser();
	const { socket } = useSocket();
	const [currentCall, setCurrentCall] = useState<any>(null);

	useEffect(() => {
		if (!socket || !user) return;

		socket.on('incoming-call', (call) => {
			if (call.receiverId === user.id) {
				setCurrentCall(call);
			}
		});

		return () => {
			socket.off('incoming-call');
		};
	}, [socket, user]);

	return (
		<html lang='fr' className={`h-full overflow-x-hidden`}>
			<head>
				<meta charSet='utf-8' />
				<meta name='viewport' content='width=device-width, initial-scale=1' />
				<Meta />
				<Links />
			</head>

			<SocketProvider>
				<body className='bg-slate-50 h-full min-h-full'>
					{user ? (
						<div
							className={`w-full flex justify-center items-center gap-2 py-2 px-3 text-center text-xs ${
								user.canReceiveMoney
									? 'bg-emerald-50 text-emerald-800'
									: 'bg-red-50 text-red-800'
							}`}
						>
							<span>
								{user.canReceiveMoney
									? 'Votre compte est bien configuré pour recevoir des donations'
									: 'Vous devez configurer votre compte pour recevoir des donations.'}
							</span>
							{!user.canReceiveMoney ? (
								<Link
									className={buttonVariants({
										variant: 'default',
										size: 'sm',
									})}
									to='/onboarding'
								>
									Je configure mon compte
								</Link>
							) : null}
						</div>
					) : null}
					<Navigation />
					{currentCall && (
						<IncomingCallModal
							call={currentCall}
							onAccept={() => {
								socket?.emit('accept-call', { callId: currentCall.id });
								setCurrentCall(null);
							}}
							onReject={() => {
								socket?.emit('reject-call', { callId: currentCall.id });
								setCurrentCall(null);
							}}
						/>
					)}
					<main className='h-full px-4 py-3 lg:px-12 lg:py-10'>

						<Outlet />
					</main>
					<ScrollRestoration />
					<Scripts />
					<LiveReload />
				</body>
			</SocketProvider>
		</html>
	);
}

export function ErrorBoundary() {
	return (
		<html>
			<head>
				<title>Erreur</title>
				<Meta />
				<Links />
			</head>
			<body>
				<div className="min-h-screen flex items-center justify-center">
					<div className="text-center">
						<h1 className="text-4xl font-bold text-gray-800 mb-4">Une erreur est survenue</h1>
						<p className="text-gray-600">Veuillez réessayer ultérieurement.</p>
					</div>
				</div>
				<Scripts />
			</body>
		</html>
	);
}
