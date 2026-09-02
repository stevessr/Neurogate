-- CreateTable
CREATE TABLE "user_consents" (
    "id" TEXT NOT NULL,
    "acceptedTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);
