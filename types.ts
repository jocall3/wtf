// Copyright James Burvel O’Callaghan III
// President Citibank Demo Business Inc.

import type React from 'react';
import { CHROME_VIEW_IDS } from './constants.ts';

export type ChromeViewType = typeof CHROME_VIEW_IDS[number];
export type FeatureId = string;

export interface Feature {
  id: FeatureId;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  component: React.FC<any>;
  aiConfig?: {
    model: string;
    systemInstruction?: string;
  };
}

export type ViewType = FeatureId | ChromeViewType;

export interface GeneratedFile {
  filePath: string;
  content: string;
  description: string;
}

export interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  view: ViewType;
  props?: any;
  action?: () => void;
}

export interface StructuredPrSummary {
    title: string;
    summary: string;
    changes: string[];
}

export interface User {
  name: string | null;
  login: string;
  avatar_url: string;
  email?: string | null;
}

export interface Repo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
}

export interface FileNode {
  name:string;
  type: 'file' | 'folder';
  path: string;
  content?: string;
  children?: FileNode[];
}