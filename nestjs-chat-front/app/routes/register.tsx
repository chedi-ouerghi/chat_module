import { Label } from '@radix-ui/react-label';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form, Link, useActionData, useNavigation } from '@remix-run/react';
import { z } from 'zod';
import { getOptionalUser } from '~/auth.server.ts';
import type { ActionFeedback } from '~/components/FeedbackComponent.tsx';
import { AlertFeedback } from '~/components/FeedbackComponent.tsx';
import { Icons } from '~/components/icons.tsx';
import { Button, buttonVariants } from '~/components/ui/button.tsx';
import { Input } from '~/components/ui/input.tsx';
import { authenticateUser } from '~/session.server.ts';

const registerSchema = z.object({
	email: z
		.string({
			required_error: 'Votre adresse email est requise.',
			invalid_type_error: 'Vous devez fournir une adresse email valide',
		})
		.email({
			message: 'Vous devez fournir une adresse email valide',
		}),
	password: z
		.string({
			required_error: 'Votre mot de passe est requis.',
		})
		.min(6, {
			message: 'Le mot de passe doit faire plus de 6 caractères',
		}),
	firstName: z
		.string({
			required_error: 'Votre prénom est requis',
		})
		.min(2, {
			message: 'Le prénom doit faire au moins 2 caractères',
		}),
});

export const tokenSchema = z.object({
	access_token: z.string().optional(),
	message: z.string().optional(),
	error: z.boolean().optional(),
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
	const user = await getOptionalUser({ request });

	if (user) {
		console.log('Vous êtes déjà connecté');
		// L'utilisateur est connecté
		return redirect('/');
	}

	return json({});
};

const BACKEND_URL = ' https://3705-196-203-166-66.ngrok-free.app/ ';

export const action = async ({ request }: ActionFunctionArgs) => {
	try {
		const formData = await request.formData();
		const jsonData = Object.fromEntries(formData);
		const parsedJson = registerSchema.safeParse(jsonData);

		if (parsedJson.success === false) {
			return json<ActionFeedback>({
				error: true,
				message: parsedJson.error.errors.map((err) => err.message).join(', '),
			});
		}

		const response = await fetch(`${BACKEND_URL}/auth/register`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(parsedJson.data),
		});

		const data = await response.json();

		if (data.access_token) {
			return await authenticateUser({
				request,
				userToken: data.access_token,
			});
		}

		return json<ActionFeedback>({
			error: true,
			message: data.message || 'Une erreur est survenue',
		});
	} catch (error) {
		return json<ActionFeedback>({
			error: true,
			message: error instanceof Error ? error.message : 'Une erreur est survenue',
		});
	}
};

const RegisterForm = () => {
	const formFeedback = useActionData<ActionFeedback>();
	const isLoading = useNavigation().state !== 'idle';
	return (
		<>
			<div className='container relative flex-col items-center justify-center lg:max-w-none lg:px-0'>
				<div className='mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]'>
					<div className='flex flex-col space-y-2 text-center'>
						<h1 className='text-2xl font-semibold tracking-tight'>
							Inscription
						</h1>
						<p className='text-sm text-muted-foreground'>Créez votre compte</p>
					</div>

					{/* FOrm */}
					<div className={'grid gap-6'}>
						<Form method='POST'>
							<div className='grid gap-2'>
								<div className='grid gap-1'>
									<Label className='sr-only' htmlFor='firstName'>
										Prénom
									</Label>
									<Input
										id='firstName'
										name='firstName'
										placeholder='Votre prénom'
										type='text'
										autoCapitalize='none'
										autoComplete='given-name'
										autoCorrect='off'
										required
										disabled={isLoading}
									/>
								</div>
								<div className='grid gap-1'>
									<Label className='sr-only' htmlFor='email'>
										Email
									</Label>
									<Input
										id='email'
										name='email'
										placeholder='Adresse email'
										type='email'
										autoCapitalize='none'
										autoComplete='email'
										autoCorrect='off'
										required
										disabled={isLoading}
									/>
								</div>
								<div className='grid gap-1'>
									<Label className='sr-only' htmlFor='email'>
										Mot de passe
									</Label>
									<Input
										id='password'
										name='password'
										placeholder='Mot de passe'
										type='password'
										autoCapitalize='none'
										autoComplete='password'
										autoCorrect='off'
										required
									/>
								</div>

								<AlertFeedback feedback={formFeedback} />
								<Button>
									{isLoading ? (
										<Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
									) : null}
									S'inscrire
								</Button>
							</div>
						</Form>
						<div className='relative'>
							<div className='absolute inset-0 flex items-center'>
								<span className='w-full border-t' />
							</div>
							<div className='relative flex justify-center text-xs uppercase'>
								<span className='px-2 text-muted-foreground'>
									Déjà inscrit ?
								</span>
							</div>
						</div>
						<Link to={'/'} className={buttonVariants({ variant: 'outline' })}>
							Se connecter
						</Link>
					</div>
				</div>
			</div>
		</>
	);
};

export default RegisterForm;
