/*
  Warnings:

  - You are about to drop the column `avatarFileKey` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CallType" AS ENUM ('AUDIO', 'VIDEO');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('PENDING', 'ONGOING', 'ENDED', 'REJECTED', 'MISSED');

-- DropIndex
DROP INDEX "User_avatarFileKey_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "avatarFileKey";

-- CreateTable
CREATE TABLE "ChatCall" (
    "id" TEXT NOT NULL,
    "type" "CallType" NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "callerId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,

    CONSTRAINT "ChatCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatCall_chatId_idx" ON "ChatCall"("chatId");

-- CreateIndex
CREATE INDEX "ChatCall_callerId_idx" ON "ChatCall"("callerId");

-- CreateIndex
CREATE INDEX "ChatCall_receiverId_idx" ON "ChatCall"("receiverId");

-- AddForeignKey
ALTER TABLE "ChatCall" ADD CONSTRAINT "ChatCall_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatCall" ADD CONSTRAINT "ChatCall_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatCall" ADD CONSTRAINT "ChatCall_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
