-- The name a requester typed at signup — informational only, lets the admin
-- see who's asking before approving; the admin still enters/corrects the
-- actual profile's firstName/lastName at approval time.
ALTER TABLE "SignupRequest" ADD COLUMN "requestedName" TEXT;
