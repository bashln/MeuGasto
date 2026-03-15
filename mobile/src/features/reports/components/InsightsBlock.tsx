import React from 'react';
import { View, Text as RNText, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../../../theme/colors';

interface Insight {
  id: string;
  title: string;
  description: string;
  type: 'positive' | 'negative' | 'neutral';
}

interface InsightsBlockProps {
  insights: Insight[];
  loading: boolean;
}

export const InsightsBlock: React.FC<InsightsBlockProps> = ({ 
  insights, 
  loading 
}) => {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <RNText style={styles.loadingText}>Gerando insights...</RNText>
      </View>
    );
  }

  if (insights.length === 0) {
    return null; // Don't show anything if no insights
  }

  const getCardStyle = (type: Insight['type']) => {
    if (type === 'positive') {
      return styles.insightPositive;
    }

    if (type === 'negative') {
      return styles.insightNegative;
    }

    return styles.insightNeutral;
  };

  return (
    <View style={styles.container}>
      {insights.map((insight) => (
        <View key={insight.id} style={[styles.insightCard, getCardStyle(insight.type)]}>
          <View style={styles.insightContent}>
            <RNText style={styles.insightTitle}>{insight.title}</RNText>
            <RNText style={styles.insightDescription}>{insight.description}</RNText>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: colors.text,
  },
  insightCard: {
    marginBottom: 12,
    borderLeftWidth: 4,
    paddingLeft: 12,
  },
  insightContent: {
    flex: 1,
  },
  insightPositive: {
    borderLeftColor: colors.success,
  },
  insightNegative: {
    borderLeftColor: colors.danger,
  },
  insightNeutral: {
    borderLeftColor: colors.info,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  insightDescription: {
    fontSize: 13,
    color: colors.mutedText,
    lineHeight: 18,
  },
});
