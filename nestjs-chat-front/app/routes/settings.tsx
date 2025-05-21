import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { requireUser } from '~/auth.server.ts';
import { useUser } from '~/root.tsx';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
	await requireUser({ request });
	return json({});
};

const UserSettings = () => {
	const user = useUser();

	return (
		<div className='container relative flex-col items-center justify-center lg:max-w-none lg:px-0'>
			<div className='mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]'>
				<div className='flex flex-col space-y-2 text-center'>
					<h1 className='text-2xl font-semibold tracking-tight'>
						Paramètres
					</h1>
					<p className='text-sm text-muted-foreground'>
						{user.firstName}
					</p>
				</div>
			</div>
		</div>
	);
};

export default UserSettings;
