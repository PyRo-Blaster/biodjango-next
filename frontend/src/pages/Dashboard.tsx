import {
  Folder,
  Dna,
  Calculator,
  Search,
  AlignJustify,
  TestTube,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";

export const Dashboard = () => {
  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-4">
          Welcome to BioDjango
        </h2>
        <p className="text-slate-600 dark:text-slate-300 text-lg">
          Your comprehensive toolkit for bioinformatics analysis. Select a tool
          below to get started.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link
          to="/projects"
          className="group block bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg group-hover:scale-110 transition-transform">
              <Folder className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 dark:text-white">
              Projects
            </h3>
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            Manage your sequences and analysis projects. Upload FASTA files and
            organize your data.
          </p>
        </Link>

        <Link
          to="/sequence-analysis"
          className="group block bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg group-hover:scale-110 transition-transform">
              <Dna className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 dark:text-white">
              Sequence Analysis
            </h3>
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            Analyze protein sequences for physicochemical properties like
            molecular weight and pI.
          </p>
        </Link>

        <Link
          to="/peptide-calc"
          className="group block bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg group-hover:scale-110 transition-transform">
              <Calculator className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 dark:text-white">
              Peptide Calculator
            </h3>
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            Calculate peptide properties and fragmentation patterns for mass
            spectrometry.
          </p>
        </Link>

        <Link
          to="/blast"
          className="group block bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg group-hover:scale-110 transition-transform">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 dark:text-white">
              BLAST Search
            </h3>
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            Perform sequence alignment using BLAST+ to find similarities in your
            databases.
          </p>
        </Link>

        <Link
          to="/msa"
          className="group block bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:scale-110 transition-transform">
              <AlignJustify className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 dark:text-white">
              MSA
            </h3>
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            Perform Multiple Sequence Alignments using Clustal Omega or Muscle.
          </p>
        </Link>

        <Link
          to="/primer-design"
          className="group block bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-lg group-hover:scale-110 transition-transform">
              <TestTube className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 dark:text-white">
              Primer Design
            </h3>
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            Design PCR primers with customizable parameters (Tm, GC%, size).
          </p>
        </Link>

        <Link
          to="/antibody-annotation"
          className="group block bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-lg group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 dark:text-white">
              Antibody Annotation
            </h3>
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            Identify CDRs and number antibody sequences (IMGT, Kabat).
          </p>
        </Link>
      </div>
    </div>
  );
};
