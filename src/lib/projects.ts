import { prisma } from "./prisma";

export type ProjectItemStatus = "TODO" | "IN_PROGRESS" | "DONE";

export type ProjectItemNode = {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  status: ProjectItemStatus;
  order: number;
  createdAt: Date;
  completedAt: Date | null;
  children: ProjectItemNode[];
};

export type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  createdAt: Date;
  totalItems: number;
  doneItems: number;
};

export async function listProjects(): Promise<ProjectSummary[]> {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "asc" },
    include: { items: { select: { status: true } } },
  });
  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    icon: p.icon,
    color: p.color,
    createdAt: p.createdAt,
    totalItems: p.items.length,
    doneItems: p.items.filter((i) => i.status === "DONE").length,
  }));
}

export async function getProjectWithTree(id: string) {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return null;
  const items = await prisma.projectItem.findMany({
    where: { projectId: id },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  // build tree
  const map = new Map<string, ProjectItemNode>();
  for (const it of items) {
    map.set(it.id, {
      id: it.id,
      projectId: it.projectId,
      parentId: it.parentId,
      title: it.title,
      status: (it.status as ProjectItemStatus) ?? "TODO",
      order: it.order,
      createdAt: it.createdAt,
      completedAt: it.completedAt,
      children: [],
    });
  }
  const roots: ProjectItemNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // count totals (recursive)
  function counts(nodes: ProjectItemNode[]): { total: number; done: number } {
    let total = 0;
    let done = 0;
    for (const n of nodes) {
      total += 1;
      if (n.status === "DONE") done += 1;
      const c = counts(n.children);
      total += c.total;
      done += c.done;
    }
    return { total, done };
  }
  const { total, done } = counts(roots);

  return { project, roots, totalItems: total, doneItems: done };
}
