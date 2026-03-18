package com.globits.core.utils;

import java.io.IOException;
import java.io.InputStream;

import org.apache.commons.lang3.StringUtils;
import org.owasp.validator.html.AntiSamy;
import org.owasp.validator.html.CleanResults;
import org.owasp.validator.html.Policy;
import org.owasp.validator.html.PolicyException;
import org.owasp.validator.html.ScanException;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;

@Service
public class HtmlUtils implements InitializingBean {

	@Autowired
	private ResourceLoader resourceLoader;

	private AntiSamy sanitizer = null;

	@Override
	public void afterPropertiesSet() throws Exception {

		try (InputStream is = resourceLoader.getResource("classpath:antisamy.xml").getInputStream()) {
			Policy policy = Policy.getInstance(is);
			sanitizer = new AntiSamy(policy);
		} catch (IOException e1) {
			e1.printStackTrace();
		}
	}

	public String removeXSSThreats(String input) {

		if (CommonUtils.isEmpty(input)) {
			return StringUtils.EMPTY;
		}

		CleanResults scanned = null;

		try {
			scanned = sanitizer.scan(input);
		} catch (PolicyException e) {
			e.printStackTrace();
		} catch (ScanException e) {
			e.printStackTrace();
		}

		if (CommonUtils.isNull(scanned)) {
			return input;
		}

		return scanned.getCleanHTML();
	}
}
