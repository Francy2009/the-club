-- Store only a salted hash of the user/admin recovery phrase.
-- The phrase itself is never persisted.
ALTER TABLE "Member" ADD COLUMN "recovery_phrase_hash" TEXT;
