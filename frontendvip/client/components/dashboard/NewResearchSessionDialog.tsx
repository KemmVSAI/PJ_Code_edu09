import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RESEARCH_DOMAINS, RESEARCH_OBJECTIVES } from "@/lib/research-data";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 40 }, (_, index) =>
  String(CURRENT_YEAR - index),
);

const newSessionSchema = z
  .object({
    topic: z.string().trim().min(3, "Add a topic of at least 3 characters"),
    researchQuestion: z
      .string()
      .trim()
      .min(10, "Describe the research question in more detail"),
    objective: z.string().min(1, "Choose an objective"),
    domain: z.string().min(1, "Choose a research domain"),
    keywords: z.string().trim().min(2, "Add at least one keyword"),
    yearFrom: z.string().min(1, "Choose a start year"),
    yearTo: z.string().min(1, "Choose an end year"),
  })
  .refine((values) => Number(values.yearFrom) <= Number(values.yearTo), {
    path: ["yearTo"],
    message: "End year must be on or after the start year",
  });

export type NewResearchSessionValues = z.infer<typeof newSessionSchema>;

interface NewResearchSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (values: NewResearchSessionValues) => void;
}

export function NewResearchSessionDialog({
  open,
  onOpenChange,
  onCreate,
}: NewResearchSessionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto p-0">
        <NewResearchSessionForm
          onCancel={() => onOpenChange(false)}
          onSubmitValues={(values) => {
            onCreate(values);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function NewResearchSessionForm({
  onCancel,
  onSubmitValues,
}: {
  onCancel: () => void;
  onSubmitValues: (values: NewResearchSessionValues) => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<NewResearchSessionValues>({
    resolver: zodResolver(newSessionSchema),
    defaultValues: {
      topic: "",
      researchQuestion: "",
      objective: "",
      domain: "",
      keywords: "",
      yearFrom: "2018",
      yearTo: String(CURRENT_YEAR),
    },
  });

  return (
    <form noValidate onSubmit={handleSubmit(onSubmitValues)}>
      <DialogHeader className="border-b border-border px-6 py-5 text-left">
        <DialogTitle className="text-xl">New research session</DialogTitle>
        <DialogDescription>
          Define the scope so the agent can plan searches and screening
          criteria.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5 px-6 py-6 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="session-topic">Topic</Label>
          <Input
            id="session-topic"
            placeholder="e.g. Large language models in clinical decision support"
            aria-invalid={!!errors.topic}
            {...register("topic")}
          />
          {errors.topic && (
            <p className="text-sm text-destructive">{errors.topic.message}</p>
          )}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="session-question">Research question</Label>
          <Textarea
            id="session-question"
            rows={3}
            placeholder="What exactly do you want the review to answer?"
            aria-invalid={!!errors.researchQuestion}
            {...register("researchQuestion")}
          />
          {errors.researchQuestion && (
            <p className="text-sm text-destructive">
              {errors.researchQuestion.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="session-objective">Objective</Label>
          <Controller
            name="objective"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="session-objective"
                  aria-invalid={!!errors.objective}
                >
                  <SelectValue placeholder="Select objective" />
                </SelectTrigger>
                <SelectContent>
                  {RESEARCH_OBJECTIVES.map((objective) => (
                    <SelectItem key={objective} value={objective}>
                      {objective}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.objective && (
            <p className="text-sm text-destructive">
              {errors.objective.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="session-domain">Research domain</Label>
          <Controller
            name="domain"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="session-domain"
                  aria-invalid={!!errors.domain}
                >
                  <SelectValue placeholder="Select domain" />
                </SelectTrigger>
                <SelectContent>
                  {RESEARCH_DOMAINS.map((domain) => (
                    <SelectItem key={domain} value={domain}>
                      {domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.domain && (
            <p className="text-sm text-destructive">{errors.domain.message}</p>
          )}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="session-keywords">Keywords</Label>
          <Input
            id="session-keywords"
            placeholder="clinical NLP, large language models, decision support"
            aria-invalid={!!errors.keywords}
            {...register("keywords")}
          />
          {errors.keywords ? (
            <p className="text-sm text-destructive">
              {errors.keywords.message}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Separate keywords with commas.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="session-year-from">Start year</Label>
          <Controller
            name="yearFrom"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="session-year-from">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {YEAR_OPTIONS.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.yearFrom && (
            <p className="text-sm text-destructive">
              {errors.yearFrom.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="session-year-to">End year</Label>
          <Controller
            name="yearTo"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="session-year-to"
                  aria-invalid={!!errors.yearTo}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {YEAR_OPTIONS.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.yearTo && (
            <p className="text-sm text-destructive">{errors.yearTo.message}</p>
          )}
        </div>
      </div>

      <DialogFooter className="gap-2 border-t border-border bg-slate-50/70 px-6 py-4 sm:space-x-0">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Create session</Button>
      </DialogFooter>
    </form>
  );
}
