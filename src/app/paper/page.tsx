"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Header } from "@/components/layout/header";
import { PaperStudyPanel } from "@/components/paper-study/paper-study-panel";
import { ArticlePreview } from "@/components/paper-study/article-preview";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { usePaperNotesDir } from "@/lib/hooks/use-paper-notes-dir";
import {
  usePaperStudyCache,
  type PaperStudyCacheData,
} from "@/lib/hooks/use-paper-study-cache";
import type { Article } from "@/lib/article-search/types";

export default function PaperPage() {
  const { cachedState, saveCache } = usePaperStudyCache();
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(
    cachedState?.selectedArticle ?? null
  );
  const { notesDir, setNotesDir } = usePaperNotesDir();

  // Keep latest state snapshot for saving on unmount / beforeunload
  const latestStateRef = useRef<PaperStudyCacheData | null>(null);

  const handleStateChange = useCallback(
    (state: PaperStudyCacheData) => {
      latestStateRef.current = state;
    },
    []
  );

  // Save cache on unmount and beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (latestStateRef.current) saveCache(latestStateRef.current);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (latestStateRef.current) saveCache(latestStateRef.current);
    };
  }, [saveCache]);

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header />
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize={60} minSize={30}>
            <PaperStudyPanel
              workspaceId=""
              onArticleSelect={setSelectedArticle}
              notesDir={notesDir}
              initialCache={cachedState}
              onStateChange={handleStateChange}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={40} minSize={20}>
            <ArticlePreview
              article={selectedArticle}
              workspaceId=""
              onClose={() => setSelectedArticle(null)}
              notesDir={notesDir}
              onSetNotesDir={setNotesDir}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
