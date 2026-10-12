"use client";
import {
  Gamepad2,
  Music,
  Camera,
  Smile,
  Sparkles,
  Dumbbell,
  Palette,
  Globe,
  ArrowRight,
} from "lucide-react";
import type { Creator, World } from "@/lib/social/client";
import { worldCover, count } from "@/lib/social/client";
export function WorldIcon({
  name,
  size = 20,
}: {
  name: string;
  size?: number;
}) {
  const Icon =
    (
      {
        gamepad: Gamepad2,
        music: Music,
        camera: Camera,
        smile: Smile,
        sparkles: Sparkles,
        dumbbell: Dumbbell,
        palette: Palette,
        globe: Globe,
      } as Record<string, typeof Globe>
    )[name] || Globe;
  return <Icon size={size} />;
}
export function Avatar({
  person,
  size = "",
}: {
  person: Pick<Creator, "display_name" | "avatar_path_url" | "accent">;
  size?: string;
}) {
  return (
    <span
      className={"social-avatar " + size}
      style={{ background: person.accent || "#7954ff" }}
    >
      {person.avatar_path_url ? (
        <img src={person.avatar_path_url} alt="" />
      ) : (
        person.display_name?.slice(0, 1) || "?"
      )}
    </span>
  );
}
export function WorldCard({
  world,
  selected = false,
  onClick,
}: {
  world: World;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={"world-card " + (selected ? "selected" : "")}
      onClick={onClick}
    >
      <img src={worldCover(world)} alt="" />
      <div className="world-shade" />
      <div className="world-card-content">
        <span className={"world-symbol " + world.icon}>
          <WorldIcon name={world.icon} size={22} />
        </span>
        <strong>{world.name}</strong>
        <small>
          {world.description || world.topics.join(" · ") || world.category}
        </small>
        <span className="world-card-meta">
          {world.kind === "personal"
            ? "Private feed"
            : count(world.member_count) + " members"}
        </span>
      </div>
    </button>
  );
}
export function Empty({
  title,
  text,
  action,
  label = "Create a post",
}: {
  title: string;
  text: string;
  action?: () => void;
  label?: string;
}) {
  return (
    <div className="social-empty">
      <span className="empty-symbol">
        <Sparkles size={24} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="primary" onClick={action}>
          {label}
          <ArrowRight size={15} />
        </button>
      )}
    </div>
  );
}
