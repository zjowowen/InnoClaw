"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getStructuredRoleDisplayName } from "@/lib/deep-research/role-registry";
import type { DeepResearchNode } from "@/lib/deep-research/types";
import { Bot, FlaskConical, GraduationCap, Server } from "lucide-react";

type WorkbenchKind = "agent" | "paperStudy" | "research" | "cluster";

interface WorkbenchPanelProps {
  selectedNode: DeepResearchNode | null;
  onOpenAgent?: () => void;
  onOpenPaperStudy?: () => void;
  onOpenResearchExec?: () => void;
  onOpenCluster?: () => void;
}

type WorkbenchCard = {
  id: WorkbenchKind;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  recommendedRoles: string[];
  onOpen?: () => void;
};

function getFocusedRoleId(selectedNode: DeepResearchNode | null): string {
  if (!selectedNode) {
    return "researcher";
  }

  const roleId = selectedNode.input?.roleId;
  return typeof roleId === "string" ? roleId : selectedNode.assignedRole;
}

export function WorkbenchPanel({
  selectedNode,
  onOpenAgent,
  onOpenPaperStudy,
  onOpenResearchExec,
  onOpenCluster,
}: WorkbenchPanelProps) {
  const focusedRoleId = getFocusedRoleId(selectedNode);
  const cards: WorkbenchCard[] = [
    {
      id: "agent",
      title: "Agent Workspace",
      description:
        "Use the general coding and reasoning agent for implementation planning, rapid prototyping, debugging, and draft writing.",
      icon: Bot,
      recommendedRoles: [
        "researcher",
        "research_software_engineer",
        "results_and_evidence_analyst",
        "research_asset_reuse_specialist",
      ],
      onOpen: onOpenAgent,
    },
    {
      id: "paperStudy",
      title: "Paper Study",
      description:
        "Use the literature workspace for paper triage, citation reading, benchmark comparison, and evidence extraction.",
      icon: GraduationCap,
      recommendedRoles: [
        "literature_intelligence_analyst",
        "researcher",
      ],
      onOpen: onOpenPaperStudy,
    },
    {
      id: "research",
      title: "Research Exec",
      description:
        "Use the experiment workspace for execution planning, remote profile binding, run configuration, and runtime preparation.",
      icon: FlaskConical,
      recommendedRoles: [
        "experiment_architecture_designer",
        "research_software_engineer",
        "experiment_operations_engineer",
      ],
      onOpen: onOpenResearchExec,
    },
    {
      id: "cluster",
      title: "Cluster Ops",
      description:
        "Use the cluster workspace for runtime inspection, infrastructure checks, and operational troubleshooting.",
      icon: Server,
      recommendedRoles: [
        "experiment_operations_engineer",
        "researcher",
      ],
      onOpen: onOpenCluster,
    },
  ];

  return (
    <div className="h-full overflow-auto">
      <div className="p-3 space-y-4">
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold">Integrated Workbenches</div>
              <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
                The existing workspace capabilities are now reachable from the Deep Research session.
                Switch into the appropriate workbench for literature work, coding, execution, or cluster operations,
                then return to this session to keep the role-based workflow coherent.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px]">
              Focus role: {getStructuredRoleDisplayName(focusedRoleId)}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {cards.map((card) => {
            const Icon = card.icon;
            const isRecommended = card.recommendedRoles.includes(focusedRoleId);

            return (
              <Card
                key={card.id}
                className={isRecommended ? "border-primary/50 shadow-sm ring-1 ring-primary/15" : undefined}
              >
                <CardHeader className="gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`rounded-lg p-2 ${isRecommended ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm">{card.title}</CardTitle>
                      <CardDescription className="mt-1 text-xs leading-relaxed">
                        {card.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {card.recommendedRoles.map((roleId) => (
                      <Badge
                        key={roleId}
                        variant={roleId === focusedRoleId ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {getStructuredRoleDisplayName(roleId)}
                      </Badge>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={card.onOpen}
                    disabled={!card.onOpen}
                  >
                    Open {card.title}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
