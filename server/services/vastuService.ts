/**
 * ARCHORA VASTUVISION DETERMINISTIC EVALUATION SERVICE
 * 
 * Deterministic spatial analysis engine that computes directional orientations,
 * evaluates room placements against classical Vastu Shastra canons,
 * and synthesizes architectural guidance.
 */

import { VASTU_DIRECTIONS, VASTU_RULES_CATALOG, VastuRule } from './vastuKnowledgeBase';
import { geminiService } from './geminiService';

export interface RoomPlacementInput {
  id: string;
  name: string;
  spaceType: string;
  // Either explicit direction or normalized coordinates (0..1, 0..1 relative to plan bounds)
  direction?: string;
  x?: number; // 0.0 to 1.0
  y?: number; // 0.0 to 1.0
  width?: number;
  height?: number;
  notes?: string;
}

export interface RoomEvaluationResult {
  roomId: string;
  roomName: string;
  spaceType: string;
  detectedDirection: string;
  directionDegrees: number;
  status: 'Matches selected Vastu guidance' | 'Acceptable traditional alternative' | 'Potential deviation' | 'Needs manual verification' | 'Insufficient information';
  concordance: 'high' | 'acceptable' | 'deviation' | 'review' | 'unknown';
  matchedRuleId: string | null;
  traditionalRecommendation: string;
  explanation: string;
  architecturalRationale: string;
  sourceReference: string;
  tradition: string;
  confidenceLevel: string;
  suggestedDirections: string[];
  remedyOrAlternative: string;
}

export interface VastuAnalysisEvaluation {
  buildingType: string;
  geographicNorthDegrees: number;
  tradition: string;
  totalRooms: number;
  matchesCount: number;
  acceptableCount: number;
  deviationsCount: number;
  reviewCount: number;
  alignmentScore: number; // 0 - 100%
  overallAssessment: string;
  roomEvaluations: RoomEvaluationResult[];
  environmentalSummary: string;
  disclaimer: string;
}

export class VastuService {
  /**
   * Calculate directional sector from normalized (x,y) coordinates and geographic north angle.
   * Coordinate system: (0,0) top-left, (1,1) bottom-right.
   * North angle: 0 deg means UP is North; 90 deg means RIGHT is North.
   */
  public calculateDirection(x: number, y: number, northDegrees: number = 0): { direction: string; degrees: number } {
    const cx = 0.5;
    const cy = 0.5;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // If within central 16% radius, classified as Brahmasthan (Center)
    if (dist < 0.16) {
      return { direction: 'Center', degrees: 0 };
    }

    // In canvas/screen space: dx positive = right, dy positive = down
    // Standard screen angle where top is 0 deg:
    // angle = atan2(dx, -dy) gives 0 at top, 90 at right, 180 at bottom, 270 at left
    let screenAngle = Math.atan2(dx, -dy) * (180 / Math.PI);
    if (screenAngle < 0) {
      screenAngle += 360;
    }

    // Adjust for geographic north rotation
    let trueAngle = (screenAngle - northDegrees + 360) % 360;

    // Map true angle to 8 directional sectors
    if (trueAngle >= 337.5 || trueAngle < 22.5) {
      return { direction: 'North', degrees: Math.round(trueAngle) };
    } else if (trueAngle >= 22.5 && trueAngle < 67.5) {
      return { direction: 'North-East', degrees: Math.round(trueAngle) };
    } else if (trueAngle >= 67.5 && trueAngle < 112.5) {
      return { direction: 'East', degrees: Math.round(trueAngle) };
    } else if (trueAngle >= 112.5 && trueAngle < 157.5) {
      return { direction: 'South-East', degrees: Math.round(trueAngle) };
    } else if (trueAngle >= 157.5 && trueAngle < 202.5) {
      return { direction: 'South', degrees: Math.round(trueAngle) };
    } else if (trueAngle >= 202.5 && trueAngle < 247.5) {
      return { direction: 'South-West', degrees: Math.round(trueAngle) };
    } else if (trueAngle >= 247.5 && trueAngle < 292.5) {
      return { direction: 'West', degrees: Math.round(trueAngle) };
    } else {
      return { direction: 'North-West', degrees: Math.round(trueAngle) };
    }
  }

  /**
   * Find matching rule for space type in catalog.
   */
  public findRuleForSpace(spaceType: string, preferredTradition?: string): VastuRule | undefined {
    const normalizedType = spaceType.trim().toLowerCase();
    
    // First try exact space type match
    let rules = VASTU_RULES_CATALOG.filter(r => 
      r.space_type.toLowerCase() === normalizedType ||
      r.topic.toLowerCase().includes(normalizedType) ||
      normalizedType.includes(r.space_type.toLowerCase())
    );

    if (rules.length === 0) {
      // Fuzzy keywords matching
      rules = VASTU_RULES_CATALOG.filter(r => {
        const key = r.space_type.toLowerCase();
        if (normalizedType.includes('kitchen') || normalizedType.includes('cook')) return key.includes('kitchen');
        if (normalizedType.includes('bed') && normalizedType.includes('master')) return key.includes('master');
        if (normalizedType.includes('child') || normalizedType.includes('kid')) return key.includes('child');
        if (normalizedType.includes('guest')) return key.includes('guest');
        if (normalizedType.includes('puja') || normalizedType.includes('prayer') || normalizedType.includes('temple') || normalizedType.includes('mandir')) return key.includes('prayer');
        if (normalizedType.includes('living') || normalizedType.includes('hall') || normalizedType.includes('drawing')) return key.includes('living');
        if (normalizedType.includes('dine') || normalizedType.includes('dining')) return key.includes('dining');
        if (normalizedType.includes('study') || normalizedType.includes('library') || normalizedType.includes('office')) return key.includes('study');
        if (normalizedType.includes('bath') || normalizedType.includes('toilet') || normalizedType.includes('wc') || normalizedType.includes('wash')) return key.includes('bathroom');
        if (normalizedType.includes('stair') || normalizedType.includes('step')) return key.includes('staircase');
        if (normalizedType.includes('water') || normalizedType.includes('tank') || normalizedType.includes('sump')) return key.includes('water');
        if (normalizedType.includes('door') || normalizedType.includes('entry') || normalizedType.includes('entrance') || normalizedType.includes('gate')) return key.includes('entrance');
        if (normalizedType.includes('court') || normalizedType.includes('garden') || normalizedType.includes('brahma')) return key.includes('garden');
        return false;
      });
    }

    if (rules.length === 0) return undefined;

    // Filter by tradition if requested and available
    if (preferredTradition) {
      const traditionMatch = rules.find(r => r.tradition === preferredTradition);
      if (traditionMatch) return traditionMatch;
    }

    return rules[0];
  }

  /**
   * Deterministically evaluate an entire set of room placements.
   */
  public evaluateLayout(
    rooms: RoomPlacementInput[],
    geographicNorthDegrees: number = 0,
    buildingType: string = 'Residential',
    tradition: string = 'Manasara'
  ): VastuAnalysisEvaluation {
    let matchesCount = 0;
    let acceptableCount = 0;
    let deviationsCount = 0;
    let reviewCount = 0;

    const evaluations: RoomEvaluationResult[] = rooms.map((room) => {
      // Determine direction
      let assignedDirection = room.direction;
      let degrees = 0;

      if (!assignedDirection && room.x !== undefined && room.y !== undefined) {
        const calc = this.calculateDirection(room.x, room.y, geographicNorthDegrees);
        assignedDirection = calc.direction;
        degrees = calc.degrees;
      } else if (assignedDirection) {
        const dirObj = VASTU_DIRECTIONS.find(d => d.id.toLowerCase() === assignedDirection?.toLowerCase());
        degrees = dirObj ? dirObj.degrees : 0;
      } else {
        assignedDirection = 'Needs manual verification';
      }

      const rule = this.findRuleForSpace(room.spaceType, tradition);

      if (!rule) {
        reviewCount++;
        return {
          roomId: room.id,
          roomName: room.name,
          spaceType: room.spaceType,
          detectedDirection: assignedDirection,
          directionDegrees: degrees,
          status: 'Needs manual verification',
          concordance: 'review',
          matchedRuleId: null,
          traditionalRecommendation: 'Space type requires manual verification or custom architectural planning.',
          explanation: 'No direct classical canon match found for this custom room designation.',
          architecturalRationale: 'Verify egress, ventilation, daylighting, and functional zoning according to local building codes.',
          sourceReference: 'General Architectural Standards',
          tradition: tradition,
          confidenceLevel: 'Unverified/Modern Extension',
          suggestedDirections: ['North', 'East', 'North-West'],
          remedyOrAlternative: 'Ensure adequate window sizing and acoustic separation.'
        };
      }

      // Check concordance
      const isPrimary = rule.direction.toLowerCase() === assignedDirection.toLowerCase();
      const isFavorable = rule.favorable_directions.some(d => d.toLowerCase() === assignedDirection.toLowerCase());
      const isUnfavorable = rule.unfavorable_directions.some(d => d.toLowerCase() === assignedDirection.toLowerCase());

      if (isPrimary) {
        matchesCount++;
        return {
          roomId: room.id,
          roomName: room.name,
          spaceType: room.spaceType,
          detectedDirection: assignedDirection,
          directionDegrees: degrees,
          status: 'Matches selected Vastu guidance',
          concordance: 'high',
          matchedRuleId: rule.rule_id,
          traditionalRecommendation: rule.recommendation,
          explanation: rule.explanation,
          architecturalRationale: rule.architectural_rationale,
          sourceReference: rule.source_reference,
          tradition: rule.tradition,
          confidenceLevel: rule.confidence_level,
          suggestedDirections: rule.favorable_directions,
          remedyOrAlternative: 'Placement aligns harmoniously with canonical directional guidance.'
        };
      } else if (isFavorable) {
        acceptableCount++;
        return {
          roomId: room.id,
          roomName: room.name,
          spaceType: room.spaceType,
          detectedDirection: assignedDirection,
          directionDegrees: degrees,
          status: 'Acceptable traditional alternative',
          concordance: 'acceptable',
          matchedRuleId: rule.rule_id,
          traditionalRecommendation: `Primary direction is ${rule.direction}, but ${assignedDirection} is an accepted classical alternative.`,
          explanation: rule.explanation,
          architecturalRationale: rule.architectural_rationale,
          sourceReference: rule.source_reference,
          tradition: rule.tradition,
          confidenceLevel: rule.confidence_level,
          suggestedDirections: rule.favorable_directions,
          remedyOrAlternative: `Acceptable alternative per ${rule.tradition}. Optimize natural cross-ventilation.`
        };
      } else if (isUnfavorable) {
        deviationsCount++;
        return {
          roomId: room.id,
          roomName: room.name,
          spaceType: room.spaceType,
          detectedDirection: assignedDirection,
          directionDegrees: degrees,
          status: 'Potential deviation',
          concordance: 'deviation',
          matchedRuleId: rule.rule_id,
          traditionalRecommendation: `Traditional guidance advises ${rule.direction} or ${rule.favorable_directions.join(', ')}. Placement in ${assignedDirection} is traditionally discouraged.`,
          explanation: rule.explanation,
          architecturalRationale: rule.architectural_rationale,
          sourceReference: rule.source_reference,
          tradition: rule.tradition,
          confidenceLevel: rule.confidence_level,
          suggestedDirections: rule.favorable_directions,
          remedyOrAlternative: `If architectural or structural constraints prevent relocating to ${rule.favorable_directions.join(' or ')}, ensure robust environmental buffer screens, light fixtures, or color balancing.`
        };
      } else {
        reviewCount++;
        return {
          roomId: room.id,
          roomName: room.name,
          spaceType: room.spaceType,
          detectedDirection: assignedDirection,
          directionDegrees: degrees,
          status: 'Needs manual verification',
          concordance: 'review',
          matchedRuleId: rule.rule_id,
          traditionalRecommendation: rule.recommendation,
          explanation: rule.explanation,
          architecturalRationale: rule.architectural_rationale,
          sourceReference: rule.source_reference,
          tradition: rule.tradition,
          confidenceLevel: rule.confidence_level,
          suggestedDirections: rule.favorable_directions,
          remedyOrAlternative: `Review layout relative to site boundaries. Consider shifting functional zones toward ${rule.favorable_directions[0]}.`
        };
      }
    });

    const totalRooms = rooms.length;
    let alignmentScore = 100;
    if (totalRooms > 0) {
      const weightedScore = (matchesCount * 1.0 + acceptableCount * 0.8 + reviewCount * 0.5 + deviationsCount * 0.1) / totalRooms;
      alignmentScore = Math.round(weightedScore * 100);
    }

    let overallAssessment = 'Balanced spatial layout.';
    if (deviationsCount === 0 && matchesCount > 0) {
      overallAssessment = 'Exceptional canonical alignment with selected Vastu principles and bioclimatic orientation.';
    } else if (deviationsCount > 0 && matchesCount >= deviationsCount) {
      overallAssessment = `Functional floor plan with ${deviationsCount} potential directional deviations noted for review against modern spatial priorities.`;
    } else if (deviationsCount > matchesCount) {
      overallAssessment = 'Multiple canonical deviations detected; consider rebalancing room placements against solar orientation and cross-ventilation axes.';
    }

    const environmentalSummary = `Geographic orientation is oriented at ${geographicNorthDegrees}° off canvas vertical. In this arrangement, morning solar radiation penetrates East and North-East facades, providing daylight to early-morning zones, while South and South-West boundaries receive maximum thermal insolation.`;

    const disclaimer = 'ARCHITECTURAL & CULTURAL RESPONSIBILITY NOTICE: Vastu Shastra is presented here as a traditional Indian knowledge system and vernacular architectural methodology. Recommendations are educational and reflective; they do not guarantee supernatural outcomes, financial prosperity, or health. Modern building codes, life safety, egress, structural integrity, universal accessibility, and environmental standards always take precedence over traditional placement recommendations.';

    return {
      buildingType,
      geographicNorthDegrees,
      tradition,
      totalRooms,
      matchesCount,
      acceptableCount,
      deviationsCount,
      reviewCount,
      alignmentScore,
      overallAssessment,
      roomEvaluations: evaluations,
      environmentalSummary,
      disclaimer
    };
  }

  /**
   * Request AI architectural commentary from backend Gemini (Zero-Cost Policy enforced).
   */
  public async generateAiCommentary(
    evaluation: VastuAnalysisEvaluation,
    userQuery?: string
  ): Promise<string> {
    const prompt = `
You are an expert Architectural Scholar and Indian Vastu Shastra Consultant analyzing an architectural layout.
Zero-Cost Policy & Truthfulness Notice: Rely exclusively on the provided deterministic analysis and classical architectural canons (*Manasara*, *Mayamata*, *Brihat Samhita*). Do NOT fabricate rules, superstitions, or fake scriptures.

Analysis Data:
- Building Type: ${evaluation.buildingType}
- Geographic North Offset: ${evaluation.geographicNorthDegrees}°
- Tradition: ${evaluation.tradition}
- Alignment Score: ${evaluation.alignmentScore}%
- Matches: ${evaluation.matchesCount}, Acceptables: ${evaluation.acceptableCount}, Deviations: ${evaluation.deviationsCount}
- Overall Assessment: ${evaluation.overallAssessment}

Room Placements & Findings:
${evaluation.roomEvaluations.map(r => `- ${r.roomName} (${r.spaceType}): Placed in ${r.detectedDirection}. Status: [${r.status}]. Canonical Source: ${r.sourceReference}. Environmental Rationale: ${r.architecturalRationale}`).join('\n')}

${userQuery ? `User Specific Question: "${userQuery}"` : 'Please provide a structured architectural synthesis:'}
1. Spatial Harmony & Orientation Summary (2-3 sentences)
2. Bioclimatic & Environmental Alignment (passive solar, ventilation, daylighting)
3. Constructive Architectural Recommendations for any deviations without requiring structural demolition
4. Clear ethical reminder that building regulations, structural safety, and functional practicality supersede traditional guidelines.
`;

    const aiResponse = await geminiService.generateText(prompt, {
      temperature: 0.3,
      maxOutputTokens: 1000
    });

    return aiResponse.text;
  }
}

export const vastuService = new VastuService();
