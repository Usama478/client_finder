import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Layers3, Plus, Sparkles } from "lucide-react";

import { EmptyState } from "../../components/page/EmptyState";
import { ErrorState } from "../../components/page/ErrorState";
import { LoadingState } from "../../components/page/LoadingState";
import { PageHeader } from "../../components/page/PageHeader";
import { StatusNotice } from "../../components/page/StatusNotice";
import { StatCard } from "../../components/StatCard";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { createContext, fetchContexts } from "../../services/api";
import type { SearchContext } from "../../types/search-context";

export function ContextsPage() {
  const [contexts, setContexts] = useState<SearchContext[]>([]);
  const [selectedContextId, setSelectedContextId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [promptText, setPromptText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    const loadContexts = async () => {
      try {
        setIsLoading(true);
        setPageError(null);
        const data = await fetchContexts();
        const availableContexts: SearchContext[] = Array.isArray(data) ? data : [];
        setContexts(availableContexts);
        setSelectedContextId(availableContexts[0]?.id ?? null);
      } catch (error) {
        console.error("Failed to load contexts:", error);
        setPageError("Unable to load saved AI contexts right now.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadContexts();
  }, []);

  const selectedContext = useMemo(
    () => contexts.find((context) => context.id === selectedContextId) ?? null,
    [contexts, selectedContextId],
  );

  const handleCreateContext = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !promptText.trim()) {
      return;
    }

    try {
      setIsCreating(true);
      setCreateError(null);
      const newContext = await createContext(name.trim(), promptText.trim());
      const typedContext = newContext as SearchContext;
      setContexts((current) => [...current, typedContext]);
      setSelectedContextId(typedContext.id);
      setName("");
      setPromptText("");
    } catch (error: any) {
      console.error("Failed to create context:", error);
      setCreateError(error.response?.data?.detail || "Unable to create this context right now.");
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading AI contexts..." className="max-w-none" />;
  }

  if (pageError) {
    return (
      <div className="p-8">
        <ErrorState
          title="Unable to load contexts"
          message={pageError}
          action={(
            <Button variant="outline" onClick={() => window.location.reload()}>
              Try again
            </Button>
          )}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-8">
      <PageHeader
        title="Contexts"
        description="Create and manage the AI instructions that shape how search and validation runs behave."
        actions={(
          <Button asChild>
            <Link to="/search">Open search</Link>
          </Button>
        )}
      />

      <StatusNotice
        className="mb-8"
        title="Using real context contracts"
        description="This page reads and creates contexts through the existing backend API. Editing, archiving, and sharing are intentionally deferred."
      />

      <div className="mb-8 grid gap-6 md:grid-cols-3">
        <StatCard
          title="Saved contexts"
          value={contexts.length.toString()}
          subtitle="Reusable AI instruction sets"
          icon={<Layers3 className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
        />
        <StatCard
          title="Ready for search"
          value={selectedContext ? "Yes" : "No"}
          subtitle={selectedContext ? selectedContext.name : "Create your first context"}
          icon={<Sparkles className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
        />
        <StatCard
          title="Editing support"
          value="Later"
          subtitle="Create and list flows are live today"
          icon={<Plus className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create a new context</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateContext} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                  Context name
                </label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Healthcare practices with multi-location teams"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                  Prompt instructions
                </label>
                <Textarea
                  value={promptText}
                  onChange={(event) => setPromptText(event.target.value)}
                  placeholder="Define what the agents should prioritize, avoid, or treat as a strong qualification signal."
                  className="min-h-40"
                />
              </div>
              {createError ? (
                <ErrorState title="Unable to save context" message={createError} />
              ) : null}
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-gray-500 dark:text-zinc-400">
                  New contexts appear immediately in Search once saved.
                </p>
                <Button type="submit" disabled={isCreating || !name.trim() || !promptText.trim()}>
                  {isCreating ? "Saving..." : "Save context"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Saved library</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contexts.length === 0 ? (
                <EmptyState
                  title="No contexts yet"
                  description="Create your first AI context to make searches more intentional."
                  className="px-4 py-10"
                />
              ) : (
                contexts.map((context) => {
                  const isSelected = selectedContextId === context.id;

                  return (
                    <button
                      key={context.id}
                      type="button"
                      onClick={() => setSelectedContextId(context.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30"
                          : "border-gray-200 hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-900/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {context.name}
                          </div>
                          <div className="mt-2 max-h-[4.5rem] overflow-hidden text-sm leading-6 text-gray-500 dark:text-zinc-400">
                            {context.prompt_text}
                          </div>
                        </div>
                        <div className="text-xs uppercase tracking-[0.2em] text-gray-400 dark:text-zinc-500">
                          #{context.id}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Selected context preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedContext ? (
                <>
                  <div>
                    <div className="text-sm font-medium uppercase tracking-[0.2em] text-gray-400 dark:text-zinc-500">
                      {selectedContext.name}
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-600 dark:text-zinc-300">
                      {selectedContext.prompt_text}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild>
                      <Link to={`/search?context=${selectedContext.id}`}>Use in search</Link>
                    </Button>
                    <Button variant="outline" disabled>
                      Edit later
                    </Button>
                    <Button variant="outline" disabled>
                      Delete later
                    </Button>
                  </div>
                </>
              ) : (
                <EmptyState
                  title="Select a context"
                  description="Choose a saved context to preview its instructions."
                  className="px-4 py-10"
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
