-- Store non-secret recovery metadata for account recovery setup.
-- The recovery answer remains stored only as a salted hash in recovery_phrase_hash.
ALTER TABLE "Member" ADD COLUMN "recovery_question" TEXT;
