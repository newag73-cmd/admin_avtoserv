CREATE TABLE "Booking" ("id" TEXT NOT NULL PRIMARY KEY,"serviceId" TEXT NOT NULL,"slotStart" DATETIME NOT NULL,"slotEnd" DATETIME NOT NULL,"clientName" TEXT NOT NULL,"clientPhone" TEXT NOT NULL,"comment" TEXT,"status" TEXT NOT NULL DEFAULT 'pending',"source" TEXT NOT NULL DEFAULT 'widget',"sessionId" TEXT,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL);
CREATE UNIQUE INDEX "Booking_serviceId_slotStart_key" ON "Booking"("serviceId","slotStart");
CREATE INDEX "Booking_status_slotStart_idx" ON "Booking"("status","slotStart");
CREATE TABLE "Conversation" ("id" TEXT NOT NULL PRIMARY KEY,"sessionId" TEXT NOT NULL,"startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"lastAt" DATETIME NOT NULL,"escalated" BOOLEAN NOT NULL DEFAULT false,"flagged" BOOLEAN NOT NULL DEFAULT false);
CREATE UNIQUE INDEX "Conversation_sessionId_key" ON "Conversation"("sessionId");
CREATE TABLE "Message" ("id" TEXT NOT NULL PRIMARY KEY,"conversationId" TEXT NOT NULL,"role" TEXT NOT NULL,"content" TEXT NOT NULL,"toolName" TEXT,"refusal" BOOLEAN NOT NULL DEFAULT false,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId","createdAt");
CREATE TABLE "Lead" ("id" TEXT NOT NULL PRIMARY KEY,"reason" TEXT NOT NULL,"summary" TEXT NOT NULL,"contact" TEXT,"status" TEXT NOT NULL DEFAULT 'new',"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
