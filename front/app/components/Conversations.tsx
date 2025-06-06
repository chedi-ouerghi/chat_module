import { Form, Link } from '@remix-run/react';
import { useOptionalUser } from '~/root.tsx';
import {
	MessageSquare, Users,
	Search,
	Mail,
	Phone,
	Video, Circle,
	Clock,
	ArrowRight,
	MessageCircle,
	Plus,
	Shield
} from 'lucide-react';
import type { getConversations } from '~/server/chat.server.ts';
import type { getUsers } from '~/server/user.server.ts';

export const Conversations = ({
	conversations,
	users,
}: {
	conversations: Awaited<ReturnType<typeof getConversations>>;
	users: Awaited<ReturnType<typeof getUsers>>;
}) => {
	const connectedUser = useOptionalUser();
	if (!connectedUser) return null;
	const hasConversations = conversations.length > 0;
	const usersExceptMe = users.filter((u) => u.id !== connectedUser.id);
	const usersWithoutConversation = usersExceptMe.filter(
		(u) => !conversations.find((c) => c.users.find((u2) => u2.id === u.id))
	);

	return (
		<div className='flex flex-col gap-6 w-full mx-auto max-w-4xl p-6'>
			{/* Header avec statistiques */}
			<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
				<div className='bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-2xl p-4 border border-white/10'>
					<div className='flex items-center gap-3'>
						<div className='p-3 bg-purple-500/20 rounded-xl'>
							<Users className='h-6 w-6 text-purple-500' />
						</div>
						<div>
							<p className='text-sm text-gray-400'>Utilisateurs</p>
							<p className='text-2xl font-bold text-purple-500'>
								{users.length}
							</p>
						</div>
					</div>
				</div>

				<div className='bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl p-4 border border-white/10'>
					<div className='flex items-center gap-3'>
						<div className='p-3 bg-blue-500/20 rounded-xl'>
							<MessageCircle className='h-6 w-6 text-blue-500' />
						</div>
						<div>
							<p className='text-sm text-gray-400'>Conversations</p>
							<p className='text-2xl font-bold text-blue-500'>
								{conversations.length}
							</p>
						</div>
					</div>
				</div>

				<div className='bg-gradient-to-br from-emerald-500/10 to-green-500/10 rounded-2xl p-4 border border-white/10'>
					<div className='flex items-center gap-3'>
						<div className='p-3 bg-emerald-500/20 rounded-xl'>
							<Shield className='h-6 w-6 text-emerald-500' />
						</div>
						<div>
							<p className='text-sm text-gray-400'>En ligne</p>
							<p className='text-2xl font-bold text-emerald-500'>
								{usersWithoutConversation.length}
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Barre de recherche améliorée */}
			<div className='relative'>
				<input
					type='search'
					placeholder='Rechercher une conversation...'
					className='w-full bg-white/5 text-gray-200 border border-white/10 rounded-xl 
                   px-12 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50
                   placeholder:text-gray-500'
				/>
				<Search className='absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500' />
			</div>

			{/* Section utilisateurs actifs */}
			<section className='bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10'>
				<div className='flex items-center justify-between mb-6'>
					<div className='flex items-center gap-3'>
						<div className='p-2 bg-purple-500/20 rounded-xl'>
							<Users className='h-5 w-5 text-purple-400' />
						</div>
						<h2 className='text-lg font-semibold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent'>
							Utilisateurs actifs
						</h2>
					</div>
					<span className='text-xs text-gray-500 bg-white/5 px-3 py-1 rounded-full'>
						{usersWithoutConversation.length} en ligne
					</span>
				</div>

				<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
					{usersWithoutConversation.map((user) => (
						<Form method='POST' action='/conversations' key={user.id} className='group'>
							<input type='hidden' name='recipientId' value={user.id} />
							<button
								type='submit'
								className='w-full flex items-center gap-4 p-4 rounded-xl
                         bg-gradient-to-r from-white/5 to-white/10
                         border border-white/10 hover:border-white/20
                         transition-all duration-300 group-hover:scale-[1.02]'
							>
								<div className='relative'>
									<div className='h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 
                              flex items-center justify-center'>
										<span className='text-lg font-medium text-white/70'>
											{user.firstName[0]}
										</span>
									</div>
									<Circle className='absolute -bottom-1 -right-1 h-4 w-4 text-emerald-500 fill-emerald-500' />
								</div>

								<div className='flex-1 text-left'>
									<p className='font-medium text-gray-200'>{user.firstName}</p>
									<p className='text-xs text-gray-500'>Disponible</p>
								</div>

								<div className='opacity-0 group-hover:opacity-100 transition-opacity'>
									<Plus className='h-5 w-5 text-blue-400' />
								</div>
							</button>
						</Form>
					))}
				</div>
			</section>

			{/* Section conversations */}
			<section className='bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10'>
				<div className='flex items-center justify-between mb-6'>
					<div className='flex items-center gap-3'>
						<div className='p-2 bg-blue-500/20 rounded-xl'>
							<MessageSquare className='h-5 w-5 text-blue-400' />
						</div>
						<h2 className='text-lg font-semibold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent'>
							Conversations
						</h2>
					</div>
				</div>

				<div className='space-y-4'>
					{hasConversations ? (
						conversations.map((conversation) => (
							<ConversationItem conversation={conversation} key={conversation.id} />
						))
					) : (
						<div className='text-center py-12 px-4'>
							<div className='w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center'>
								<Mail className='h-8 w-8 text-blue-400' />
							</div>
							<h3 className='text-gray-300 font-medium mb-2'>
								Aucune conversation
							</h3>
							<p className='text-sm text-gray-500'>
								Démarrez une nouvelle conversation avec un utilisateur
							</p>
						</div>
					)}
				</div>
			</section>
		</div>
	);
};

// Composant ConversationItem amélioré
const ConversationItem = ({
	conversation,
}: {
	conversation: Awaited<ReturnType<typeof getConversations>>[0];
}) => {
	const hasMessage = conversation.messages.length > 0;
	const connectedUser = useOptionalUser();
	if (!connectedUser) return null;

	const otherUser = conversation.users.find(
		(user) => user.id !== connectedUser?.id
	);

	return (
		<Link
			to={`/conversations/${conversation.id}`}
			className='group block hover:bg-white/5 rounded-xl p-4 transition-all duration-300
                border border-white/5 hover:border-white/10'
		>
			<div className='flex items-center gap-4'>
				<div className='relative'>
					<div className='h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 
                       flex items-center justify-center'>
						<span className='text-lg font-medium text-white/70'>
							{otherUser?.firstName[0]}
						</span>
					</div>
					<Circle className='absolute -bottom-1 -right-1 h-4 w-4 text-emerald-500 fill-emerald-500' />
				</div>

				<div className='flex-1 min-w-0'>
					<div className='flex items-center justify-between mb-1'>
						<h3 className='font-medium text-gray-200'>{otherUser?.firstName}</h3>
						{hasMessage && (
							<div className='flex items-center gap-2'>
								<Clock className='h-3 w-3 text-gray-500' />
								<span className='text-xs text-gray-500'>
									{new Date(conversation.updatedAt).toLocaleTimeString([], {
										hour: '2-digit',
										minute: '2-digit',
									})}
								</span>
							</div>
						)}
					</div>

					<div className='flex items-center gap-2'>
						{hasMessage ? (
							<p className='text-sm text-gray-400 truncate'>
								{conversation.messages[0].content}
							</p>
						) : (
							<p className='text-sm text-gray-500 italic'>Nouvelle conversation</p>
						)}
					</div>
				</div>

				<div className='flex gap-2 items-center'>
					<button className='p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all
                         hover:bg-white/10'>
						<Phone className='h-4 w-4 text-gray-400' />
					</button>
					<button className='p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all
                         hover:bg-white/10'>
						<Video className='h-4 w-4 text-gray-400' />
					</button>
					<ArrowRight className='h-5 w-5 text-gray-500 opacity-0 group-hover:opacity-100 
                              transition-all group-hover:translate-x-1' />
				</div>
			</div>
		</Link>
	);
};
