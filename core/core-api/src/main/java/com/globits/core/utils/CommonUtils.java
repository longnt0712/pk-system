package com.globits.core.utils;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Collection;
import java.util.Date;
import java.util.HashSet;
import java.util.Set;
import java.util.TimeZone;

import org.joda.time.DateTime;
import org.joda.time.format.DateTimeFormat;
import org.joda.time.format.DateTimeFormatter;
import org.springframework.util.NumberUtils;

public final class CommonUtils {

	private static SimpleDateFormat sdf = new SimpleDateFormat("dd/MM/yyyy hh:mm:ss");

	/**
	 * Check if an object is null
	 * 
	 * @param obj
	 * @returnd
	 */
	public static boolean isNull(Object obj) {
		return obj == null;
	}

	/**
	 * Check if an object is not null
	 * 
	 * @param obj
	 * @return
	 */
	public static boolean isNotNull(Object obj) {
		return obj != null;
	}

	/**
	 * Check if a collection is empty
	 * 
	 * @param collection
	 * @return
	 */
	public static boolean isEmpty(Collection<?> collection) {
		return (collection == null) || collection.isEmpty();
	}

	/**
	 * Check if an array is empty
	 * 
	 * @param array
	 * @return
	 */
	public static boolean isEmpty(Object[] array) {
		if (array == null) {
			return true;
		}

		return array.length <= 0;
	}

	/**
	 * Check if a string is empty. If a string contains only spaces, it will not be
	 * considered empty.
	 * 
	 * @param s
	 * @return
	 */
	public static boolean isEmpty(String s) {
		return (s == null) || s.isEmpty();
	}

	/**
	 * Check if a string is empty. If a string contains only spaces, it is still
	 * considered empty if ignoreSpace = TRUE, and not considered empty otherwise.
	 * 
	 * @param s
	 * @param ignoreSpaces
	 * @return
	 */
	public static boolean isEmpty(String s, boolean ignoreSpaces) {
		return (s == null) || (ignoreSpaces ? s.trim().isEmpty() : s.isEmpty());
	}

	/**
	 * Check length of an input string
	 * 
	 * @param s
	 * @param minLength
	 * @param maxLength
	 * @return
	 */
	public static boolean isInLength(String s, int minLength, int maxLength) {
		if (minLength < 0) {
			minLength = 0;
		}

		if (maxLength < minLength) {
			maxLength = Integer.MAX_VALUE;
		}

		if (isNull(s)) {
			return false;
		}

		int length = s.length();

		return (length >= minLength) && (length <= maxLength);
	}

	/**
	 * Check if a long value is positive
	 * 
	 * @param val
	 * @param greaterThanZero
	 * @return
	 */
	public static boolean isPositive(Long val, boolean greaterThanZero) {
		return (val != null) && (greaterThanZero ? val.longValue() > 0 : val.longValue() >= 0);
	}

	/**
	 * Check if an integer value is positive
	 * 
	 * @param val
	 * @param greaterThanZero
	 * @return
	 */
	public static boolean isPositive(Integer val, boolean greaterThanZero) {
		return (val != null) && (greaterThanZero ? val.intValue() > 0 : val.intValue() >= 0);
	}

	/**
	 * Check if a float value is positive
	 * 
	 * @param val
	 * @param greaterThanZero
	 * @return
	 */
	public static boolean isPositive(Float val, boolean greaterThanZero) {
		return (val != null) && (greaterThanZero ? val.floatValue() > 0 : val.floatValue() >= 0);
	}

	/**
	 * Check if a double value is positive
	 * 
	 * @param val
	 * @param greaterThanZero
	 * @return
	 */
	public static boolean isPositive(Double val, boolean greaterThanZero) {
		return (val != null) && (greaterThanZero ? val.doubleValue() > 0 : val.doubleValue() >= 0);
	}

	/**
	 * Check if an integer value is a valid progress value
	 * 
	 * @param val
	 * @return
	 */
	public static boolean isProgress(Integer val) {
		return (val != null) && (val >= 0) && (val <= 100);
	}

	/**
	 * Parse string for an integer value
	 * 
	 * @param val
	 * @param defaultValue
	 * @return
	 */
	public static int parseInt(String val, final int defaultValue) {

		int ret = defaultValue;

		if (CommonUtils.isEmpty(val)) {
			return ret;
		} else {
			ret = NumberUtils.parseNumber(val, Integer.class);
		}

		return ret;
	}

	/**
	 * Parse string for a long value
	 * 
	 * @param val
	 * @param defaultValue
	 * @return
	 */
	public static long parseLong(String val, final long defaultValue) {

		long ret = defaultValue;

		if (CommonUtils.isEmpty(val)) {
			return ret;
		} else {
			ret = NumberUtils.parseNumber(val, Long.class);
		}

		return ret;
	}

	/**
	 * Parse string for a float value
	 * 
	 * @param val
	 * @param defaultValue
	 * @return
	 */
	public static float parseFloat(String val, final float defaultValue) {

		float ret = defaultValue;

		if (CommonUtils.isEmpty(val)) {
			return ret;
		} else {
			ret = NumberUtils.parseNumber(val, Float.class);
		}

		return ret;
	}

	/**
	 * Parse string for a double value
	 * 
	 * @param val
	 * @param defaultValue
	 * @return
	 */
	public static double parseDouble(String val, final double defaultValue) {

		double ret = defaultValue;

		if (CommonUtils.isEmpty(val)) {
			return ret;
		} else {
			ret = NumberUtils.parseNumber(val, Double.class);
		}

		return ret;
	}

	/**
	 * Parse an input string with delimiter for array of long values
	 * 
	 * @param input
	 * @param delimiter
	 * @return
	 */
	public static Long[] parseLong(String input, String delimiter, boolean dedup) {

		if (isEmpty(input) || isEmpty(delimiter)) {
			return new Long[0];
		}

		String[] splits = input.split(delimiter);
		Set<Long> vals = new HashSet<Long>();

		for (String s : splits) {
			Long val = NumberUtils.parseNumber(s, Long.class);

			if (val > 0) {
				if (dedup && !vals.contains(val.longValue())) {
					vals.add(val.longValue());
				} else {
					vals.add(val.longValue());
				}
			}
		}

		return vals.toArray(new Long[0]);
	}

	/**
	 * Replace a number with another value if the input is null
	 * 
	 * @param input
	 * @param defaultValue
	 * @return
	 */
	public static Long replaceNull(Long input, long defaultValue) {
		if (isNull(input))
			return defaultValue;

		return input;
	}

	/**
	 * Replace a number with another value if the input is null
	 * 
	 * @param input
	 * @param defaultValue
	 * @return
	 */
	public static Double replaceNull(Double input, double defaultValue) {
		if (isNull(input))
			return defaultValue;

		return input;
	}

	/**
	 * Replace a number with another value if the input is null
	 * 
	 * @param input
	 * @param defaultValue
	 * @return
	 */
	public static Integer replaceNull(Integer input, int defaultValue) {
		if (isNull(input))
			return defaultValue;

		return input;
	}

	/**
	 * Replace a number with another value if the input is null
	 * 
	 * @param input
	 * @param defaultValue
	 * @return
	 */
	public static Float replaceNull(Float input, float defaultValue) {
		if (isNull(input))
			return defaultValue;

		return input;
	}

	/**
	 * Replace a string with another value if the input is null
	 * 
	 * @param input
	 * @param defaultValue
	 * @return
	 */
	public static String replaceNull(String input, String defaultValue) {
		if (isNull(input))
			return defaultValue;

		return input;
	}

	/**
	 * Compare two number by values
	 * 
	 * @param input1
	 * @param input2
	 * @return
	 */
	public static boolean valueEqual(Integer input1, Integer input2) {
		if ((input1 == null) || (input2 == null)) {
			return false;
		}

		return (input1.intValue() == input2.intValue());
	}

	/**
	 * Compare two number by values
	 * 
	 * @param input1
	 * @param input2
	 * @return
	 */
	public static boolean valueEqual(Long input1, Long input2) {
		if ((input1 == null) || (input2 == null)) {
			return false;
		}

		return (input1.longValue() == input2.longValue());
	}

	/**
	 * Compare two dates by values
	 * 
	 * @param input1
	 * @param input2
	 * @return
	 */
	public static boolean valueEqual(DateTime input1, DateTime input2) {
		if ((input1 == null) || (input2 == null)) {
			return false;
		}

		return (input1.getMillis() == input2.getMillis());
	}

	/**
	 * Get a datetime obj from date-only data extracted from the {@value input}
	 * appended by {@value timeTrail}
	 * 
	 * @param input
	 * @param timeTrail
	 * @return
	 */
	public static DateTime getDate(DateTime input, String timeTrail) {

		DateTimeFormatter dtf = DateTimeFormat.forPattern("yyyy-MM-dd HH:mm:ss");

		String dtStr = String.valueOf(input.getYear());
		dtStr += "-";
		dtStr += input.getMonthOfYear();
		dtStr += "-";
		dtStr += input.getDayOfMonth();
		dtStr += " ";
		dtStr += timeTrail;

		return dtf.parseDateTime(dtStr);
	}

	/**
	 * Get a datetime object without the timezone trail e.g. +07:00
	 * 
	 * @param input
	 * @return
	 */
	public static DateTime getDateWithoutTimezone(DateTime input) {

		if (isNull(input)) {
			return null;
		}

		Date date = input.toDate();
		Calendar calendar = Calendar.getInstance();
		calendar.setTime(date);

		int offset = calendar.getTimeZone().getOffset(calendar.getTimeInMillis());

		calendar.add(Calendar.MILLISECOND, offset);
		calendar.setTimeZone(TimeZone.getTimeZone("UTC"));

		return new DateTime(calendar);
	}

	/**
	 * Format a datetime object to specified format
	 * 
	 * @param input
	 * @return
	 */
	public static String formatDateTime(DateTime input) {
		return sdf.format(input.toDate());
	}

	/**
	 * Format bytes count in human readable format
	 * 
	 * @param bytes
	 * @param si
	 * @return
	 */
	public static String byteCount(long bytes, boolean si) {
		int unit = si ? 1000 : 1024;
		if (bytes < unit)
			return bytes + " B";
		int exp = (int) (Math.log(bytes) / Math.log(unit));
		String pre = (si ? "kMGTPE" : "KMGTPE").charAt(exp - 1) + (si ? "" : "i");
		return String.format("%.1f %sB", bytes / Math.pow(unit, exp), pre);
	}

	/**
	 * Format a number replacing thousand with suffix 'K', million with suffix 'M'
	 * and etc.
	 * 
	 * @param count
	 * @return
	 */
	public static String withSuffix(long count) {
		if (count < 1000)
			return "" + count;
		int exp = (int) (Math.log(count) / Math.log(1000));
		return String.format("%.1f %c", count / Math.pow(1000, exp), "kMGTPE".charAt(exp - 1));
	}
}
