"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare } from "lucide-react";
import type { ReviewAssessmentExtended } from "@/lib/deep-research/types";

interface ReviewPanelProps {
  reviewResult: ReviewAssessmentExtended | null;
}

export function ReviewPanel({ reviewResult }: ReviewPanelProps) {
  if (!reviewResult) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No reviewer assessment has occurred yet. It will appear once review work has run.
      </div>
    );
  }

  const history = reviewResult.reviewHistory ?? reviewResult.rounds ?? [];
  const latestPacket = history[history.length - 1]?.reviewerPacket;
  const highlights = reviewResult.reviewHighlights ?? [];
  const openIssues = reviewResult.openIssues ?? [];

  const verdictColor = (verdict: string) => {
    switch (verdict) {
      case "approve": return "text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30";
      case "revise": return "text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30";
      case "reject": return "text-red-600 border-red-300 bg-red-50 dark:bg-red-950/30";
      default: return "";
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        {/* Summary bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={`text-xs ${verdictColor(reviewResult.combinedVerdict)}`}>
            {reviewResult.combinedVerdict}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Confidence: {(reviewResult.combinedConfidence * 100).toFixed(0)}%
          </span>
        </div>

        {latestPacket && (
          <div className="border rounded p-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3 text-blue-500" />
              <span className="text-xs font-semibold">Results and Evidence Analyst</span>
              <Badge variant="outline" className={`text-[9px] ${verdictColor(latestPacket.verdict)}`}>
                {latestPacket.verdict}
              </Badge>
            </div>
            <div className="text-[11px] leading-relaxed text-muted-foreground">
              {latestPacket.critique.slice(0, 500)}
              {latestPacket.critique.length > 500 && "..."}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Confidence: {(latestPacket.confidence * 100).toFixed(0)}%
            </div>
          </div>
        )}

        {highlights.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-semibold text-green-700 dark:text-green-400">
              Review Highlights ({highlights.length})
            </div>
            <ul className="text-xs space-y-0.5 pl-4 list-disc text-muted-foreground">
              {highlights.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}

        {openIssues.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-semibold text-red-700 dark:text-red-400">
              Open Issues ({openIssues.length})
            </div>
            <ul className="text-xs space-y-0.5 pl-4 list-disc text-muted-foreground">
              {openIssues.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}

        {/* Flags */}
        <div className="flex flex-wrap gap-1.5">
          {reviewResult.needsMoreLiterature && (
            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
              Needs more literature
            </Badge>
          )}
          {reviewResult.needsExperimentalValidation && (
            <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-300">
              Needs experimental validation
            </Badge>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
