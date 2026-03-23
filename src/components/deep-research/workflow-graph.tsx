"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node as FlowNode,
  type Edge as FlowEdge,
  type NodeProps,
  Handle,
  Position,
} from "@xyflow/react";
import dagre from "dagre";
import type { DeepResearchNode } from "@/lib/deep-research/types";
import { Badge } from "@/components/ui/badge";
import { getNodeDisplayLabel, getStructuredRoleDisplayName, getRoleColorToken } from "@/lib/deep-research/role-registry";
import {
  Brain,
  Search,
  FileText,
  Eye,
  Play,
  CheckCircle,
  Sparkles,
  BookOpen,
  Filter,
  ShieldCheck,
  ClipboardList,
  Server,
  Activity,
  FolderDown,
  GitCompare,
  Send,
} from "lucide-react";
import "@xyflow/react/dist/style.css";

interface WorkflowGraphProps {
  nodes: DeepResearchNode[];
  onNodeSelect: (nodeId: string) => void;
}

const NODE_ICONS: Record<string, React.ElementType> = {
  intake: BookOpen,
  plan: Brain,
  evidence_gather: Search,
  evidence_extract: Filter,
  summarize: FileText,
  synthesize: Sparkles,
  review: Eye,
  audit: ShieldCheck,
  validation_plan: ClipboardList,
  resource_request: Server,
  execute: Play,
  monitor: Activity,
  result_collect: FolderDown,
  result_compare: GitCompare,
  approve: CheckCircle,
  final_report: FileText,
};

const STATUS_COLORS: Record<string, { border: string; bg: string }> = {
  pending: { border: "border-gray-300 dark:border-gray-600", bg: "bg-white dark:bg-gray-900" },
  queued: { border: "border-gray-400 dark:border-gray-500", bg: "bg-gray-50 dark:bg-gray-800" },
  running: { border: "border-blue-500 animate-pulse", bg: "bg-blue-50 dark:bg-blue-950" },
  completed: { border: "border-green-500", bg: "bg-green-50 dark:bg-green-950" },
  failed: { border: "border-red-500", bg: "bg-red-50 dark:bg-red-950" },
  skipped: { border: "border-gray-300 dark:border-gray-600", bg: "bg-gray-50 dark:bg-gray-800" },
  awaiting_approval: { border: "border-yellow-500 animate-pulse", bg: "bg-yellow-50 dark:bg-yellow-950" },
  awaiting_user_confirmation: { border: "border-amber-500 animate-pulse", bg: "bg-amber-50 dark:bg-amber-950" },
  superseded: { border: "border-gray-300 dark:border-gray-600", bg: "bg-gray-100 dark:bg-gray-800 opacity-50" },
};

function CustomNode({ data }: NodeProps) {
  const nodeData = data as {
    label: string;
    nodeType: string;
    status: string;
    assignedRole: string;
    assignedModel: string | null;
    onClick: () => void;
  };
  const Icon = NODE_ICONS[nodeData.nodeType] || Brain;
  const colors = STATUS_COLORS[nodeData.status] || STATUS_COLORS.pending;
  const isSuperseded = nodeData.status === "superseded";
  const assignedRoleLabel = getStructuredRoleDisplayName(nodeData.assignedRole, nodeData.nodeType);
  const assignmentLabel = assignedRoleLabel === "Researcher"
    ? "Assigned to Researcher"
    : `Dispatched to ${assignedRoleLabel}`;

  return (
    <div
      className={`px-3 py-2 rounded-lg border-2 ${colors.border} ${colors.bg} cursor-pointer hover:shadow-md transition-shadow min-w-[200px] max-w-[220px] ${isSuperseded ? "opacity-50" : ""}`}
      onClick={nodeData.onClick}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2" />
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className={`text-xs font-medium truncate ${isSuperseded ? "line-through" : ""}`}>{getNodeDisplayLabel(nodeData.label)}</span>
      </div>
      <div className="mb-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
        <Send className="h-3 w-3 shrink-0" />
        <span className="truncate">{assignmentLabel}</span>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        <Badge className={`text-[9px] px-1 py-0 ${getRoleColorToken(nodeData.assignedRole, nodeData.nodeType)}`}>
          {assignedRoleLabel}
        </Badge>
        {nodeData.assignedModel && (
          <span className="text-[8px] text-muted-foreground font-mono truncate max-w-[100px]">
            {nodeData.assignedModel.split("/").pop()}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" />
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

function layoutGraph(
  researchNodes: DeepResearchNode[],
  onNodeSelect: (nodeId: string) => void
): { flowNodes: FlowNode[]; flowEdges: FlowEdge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 50, ranksep: 80 });

  for (const node of researchNodes) {
    g.setNode(node.id, { width: 240, height: 82 });
    for (const depId of node.dependsOn) {
      g.setEdge(depId, node.id);
    }
  }

  dagre.layout(g);

  const flowNodes: FlowNode[] = [
    ...researchNodes.map((node) => {
      const pos = g.node(node.id);
      return {
        id: node.id,
        type: "custom",
        position: { x: (pos?.x ?? 0) - 120, y: (pos?.y ?? 0) - 41 },
        data: {
          label: node.label,
          nodeType: node.nodeType,
          status: node.status,
          assignedRole: node.assignedRole,
          assignedModel: node.assignedModel,
          onClick: () => onNodeSelect(node.id),
        },
      };
    }),
  ];

  const flowEdges: FlowEdge[] = [];
  const nodeStatusMap = new Map(researchNodes.map(n => [n.id, n.status]));
  // Build set of explicit dependency edges for filtering
  const explicitEdges = new Set<string>();
  for (const node of researchNodes) {
    for (const depId of node.dependsOn) {
      explicitEdges.add(`${depId}-${node.id}`);
    }
  }
  for (const node of researchNodes) {
    for (const depId of node.dependsOn) {
      const sourceStatus = nodeStatusMap.get(depId);
      const targetStatus = node.status;
      // Animate edges where target is running, or source just completed and target is pending
      const isActive = targetStatus === "running" ||
        (sourceStatus === "completed" && targetStatus === "pending");
      flowEdges.push({
        id: `${depId}-${node.id}`,
        source: depId,
        target: node.id,
        animated: isActive,
        style: node.status === "superseded" ? { opacity: 0.3 } : undefined,
      });
    }
  }

  return { flowNodes, flowEdges };
}

export function WorkflowGraph({ nodes: researchNodes, onNodeSelect }: WorkflowGraphProps) {
  const { flowNodes: initialNodes, flowEdges: initialEdges } = useMemo(
    () => layoutGraph(researchNodes, onNodeSelect),
    [researchNodes, onNodeSelect]
  );

  const [flowNodes] = useNodesState(initialNodes);
  const [flowEdges] = useEdgesState(initialEdges);

  if (researchNodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No workflow nodes yet. Start the research to see the graph.
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
