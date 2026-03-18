import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Slider } from "../../components/ui/slider";
import { useState } from "react";
import { toast } from "sonner";

export default function ThresholdConfigPage() {
  const [relevanceThreshold, setRelevanceThreshold] = useState([75]);
  const [verificationThreshold, setVerificationThreshold] = useState([70]);
  const [confidenceThreshold, setConfidenceThreshold] = useState([60]);

  const handleSave = () => {
    toast.success("AI thresholds updated");
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Threshold Configuration</h1>
        <p className="text-gray-600 mt-1">Configure AI scoring and decision thresholds</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Relevance Scoring</CardTitle>
          <CardDescription>Set minimum score for businesses to be marked as "relevant"</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Relevance Pass Threshold</Label>
              <span className="text-2xl font-bold text-purple-600">{relevanceThreshold[0]}%</span>
            </div>
            <Slider
              value={relevanceThreshold}
              onValueChange={setRelevanceThreshold}
              min={0}
              max={100}
              step={5}
            />
            <p className="text-sm text-gray-600">
              Businesses scoring above {relevanceThreshold[0]}% will be marked as "Passed"
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verification Scoring</CardTitle>
          <CardDescription>Set minimum score for businesses to be marked as "verified"</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Verification Pass Threshold</Label>
              <span className="text-2xl font-bold text-green-600">{verificationThreshold[0]}%</span>
            </div>
            <Slider
              value={verificationThreshold}
              onValueChange={setVerificationThreshold}
              min={0}
              max={100}
              step={5}
            />
            <p className="text-sm text-gray-600">
              Businesses scoring above {verificationThreshold[0]}% will be marked as "Verified"
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Confidence Settings</CardTitle>
          <CardDescription>Set minimum confidence level for AI decisions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Low Confidence Threshold</Label>
              <span className="text-2xl font-bold text-orange-600">{confidenceThreshold[0]}%</span>
            </div>
            <Slider
              value={confidenceThreshold}
              onValueChange={setConfidenceThreshold}
              min={0}
              max={100}
              step={5}
            />
            <p className="text-sm text-gray-600">
              Decisions below {confidenceThreshold[0]}% confidence will be flagged for review
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={handleSave}>Save Configuration</Button>
      </div>
    </div>
  );
}
