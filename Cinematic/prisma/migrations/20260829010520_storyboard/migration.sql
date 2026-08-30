-- CreateTable
CREATE TABLE "StoryboardProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "storyText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryboardProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryboardScene" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "sceneText" TEXT NOT NULL,
    "cinematicState" TEXT,
    "imagePrompt" TEXT,
    "videoPrompt" TEXT,
    "imageRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryboardScene_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoryboardProject_userId_idx" ON "StoryboardProject"("userId");

-- CreateIndex
CREATE INDEX "StoryboardScene_projectId_idx" ON "StoryboardScene"("projectId");

-- AddForeignKey
ALTER TABLE "StoryboardProject" ADD CONSTRAINT "StoryboardProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryboardScene" ADD CONSTRAINT "StoryboardScene_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "StoryboardProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
