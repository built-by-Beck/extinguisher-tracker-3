/**
 * AI upgrade promo card shown to Basic plan users on the Dashboard.
 * Showcases AI capabilities with example questions to drive upgrades.
 *
 * Author: built_by_Beck
 */

import { useNavigate } from 'react-router-dom';
import { Sparkles, MessageSquare, ArrowRight, ShieldCheck, BarChart3, Clock, Zap } from 'lucide-react';

const AI_EXAMPLES = [
  {
    icon: ShieldCheck,
    question: '"Which extinguishers are overdue for inspection?"',
    description: 'AI scans your entire inventory and flags every overdue item instantly.',
  },
  {
    icon: Clock,
    question: '"When is my next 6-year maintenance due?"',
    description: 'Get NFPA 10 schedule breakdowns specific to your equipment.',
  },
  {
    icon: BarChart3,
    question: '"Summarize my compliance status"',
    description: 'AI analyzes your data and gives you an actionable compliance report.',
  },
  {
    icon: MessageSquare,
    question: '"What does NFPA 10 require for monthly inspections?"',
    description: 'Ask any compliance question and get expert-level answers on the spot.',
  },
];

export function AiUpgradeCard() {
  const navigate = useNavigate();

  return (
    <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-red-50 p-6 shadow-sm">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-red-600">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">AI Compliance Assistant</h2>
            <p className="text-sm text-gray-500">Built for faster inspections, fewer paper logs, and easier compliance</p>
          </div>
        </div>
        <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
          Pro, Elite, Enterprise
        </span>
      </div>

      {/* Pitch */}
      <p className="mb-5 text-sm text-gray-600">
        Move off paper logs and get instant answers from your dashboard. The AI assistant helps
        your team stay on schedule, cut paperwork, and keep compliance visible in real time.
      </p>

      {/* Example questions grid */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {AI_EXAMPLES.map(({ icon: Icon, question, description }) => (
          <div
            key={question}
            className="rounded-lg border border-gray-200 bg-white p-3.5 transition-shadow hover:shadow-md"
          >
            <div className="mb-2 flex items-center gap-2">
              <Icon className="h-4 w-4 text-purple-600" />
              <p className="text-xs font-semibold text-purple-700">Try asking</p>
            </div>
            <p className="mb-1 text-sm font-medium text-gray-900">{question}</p>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
        ))}
      </div>

      {/* What you get */}
      <div className="mb-5 rounded-lg bg-gray-50 p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
          <Zap className="h-4 w-4 text-amber-500" />
          What AI unlocks for your team
        </h3>
        <ul className="space-y-1.5 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" />
            Instant NFPA 10 compliance answers — no more Googling regulations
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" />
            Real-time inventory analysis that flags issues before inspectors arrive
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" />
            Maintenance schedule guidance for monthly, annual, 6-year, and hydrostatic testing
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" />
            Smart recommendations prioritized by urgency and risk
          </li>
        </ul>
      </div>

      <p className="mb-4 text-xs text-gray-500">
        How to use AI: open the assistant from any dashboard page, then ask about overdue
        inspections, maintenance dates, or a compliance summary.
      </p>

      {/* CTA */}
      <button
        onClick={() => navigate('/dashboard/settings')}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-red-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:from-purple-700 hover:to-red-700"
      >
        Upgrade to Pro to Unlock AI
        <ArrowRight className="h-4 w-4" />
      </button>
      <p className="mt-2 text-center text-xs text-gray-400">
        Also included with Elite and Enterprise plans
      </p>
    </div>
  );
}
