import { Box } from '@/components/ui/box';
import { Flex } from '@/components/ui/flex';
import { Text } from '@/components/ui/text';

interface UsageBarProps {
  value: number;
  label: string;
  compact?: boolean;
  max?: number;
}

const UsageBar = ({ value, label, compact = false, max = 100 }: UsageBarProps) => {
  const clampedValue = Math.min(Math.max(value, 0), max);
  const getColor = (val: number) => {
    if (val >= 80) return 'red';
    if (val >= 60) return 'orange';
    return 'green';
  };
  const barColor = getColor(clampedValue);

  if (compact) {
    return (
      <Box style={{ width: '100%' }}>
        <Box
          style={{
            width: '100%',
            height: '6px',
            backgroundColor: 'var(--gray-5)',
            borderRadius: '3px',
            overflow: 'hidden',
            marginBottom: '2px',
          }}
        >
          <div
            style={{
              height: '100%',
              backgroundColor: `var(--${barColor}-9)`,
              borderRadius: '3px',
              width: `${clampedValue}%`,
              transition: 'width 0.5s ease-out',
            }}
          />
        </Box>
        <label color="gray" className='text-sm'>
          {clampedValue.toFixed(1)}%
        </label>
      </Box>
    );
  }

  return (
    <Flex direction="column" gap="1" style={{ width: '100%' }}>
      <Flex justify="between" align="center">
        <Text size="2" color="gray">
          {label}
        </Text>
        <Text size="2" weight="medium">
          {clampedValue.toFixed(1)}%
        </Text>
      </Flex>
      <Box
        style={{
          width: '100%',
          height: '8px',
          backgroundColor: 'var(--gray-5)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            backgroundColor: `var(--${barColor}-9)`,
            borderRadius: '4px',
            width: `${clampedValue}%`,
            transition: 'width 0.5s ease-out',
          }}
        />
      </Box>
    </Flex>
  );
};

export default UsageBar;
