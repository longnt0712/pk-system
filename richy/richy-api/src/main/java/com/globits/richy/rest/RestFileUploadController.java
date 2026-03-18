package com.globits.richy.rest;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import javax.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.context.request.WebRequest;
import com.globits.core.repository.TrainingBaseRepository;
import com.globits.richy.dto.BodyDto;
import com.globits.richy.service.BodyService;
import com.globits.richy.utils.ImportExportExcelXLSX;

@Controller
@RequestMapping("/api/file")
public class RestFileUploadController {
	@Autowired
	private TrainingBaseRepository trainingBaseRepository;
	
	@Autowired
	private ResourceLoader resourceLoader;
	
	@Autowired
	private BodyService bodyService;
	/**
	 * POST /uploadFile -> receive and locally save a file.
	 * 
	 * @param uploadfile
	 *            The uploaded file as Multipart file parameter in the HTTP request.
	 *            The RequestParam name must be the same of the attribute "name" in
	 *            the input tag with type file.
	 * 
	 * @return An http OK status in case of success, an http 4xx status in case of
	 *         errors.
	 */
	
//	@RequestMapping(value = "/export_voucher_crocs/", method = { RequestMethod.POST })
//	public void exportReportStudentMark(WebRequest request, HttpServletResponse response, @RequestBody VoucherCrocsDto searchDto) {
//		try {
//			Resource resource = resourceLoader.getResource("classpath:THONG_KE.xlsx");
//			InputStream ip = resource.getInputStream(); // <-- Lấy file trong resource đưa về dạng InputStream
//
//			List<VoucherCrocsDto> list = voucherCrocsService.getListObject(searchDto);
//			VoucherCrocsDto dtoOrder = voucherCrocsService.getShopNumberOrders(searchDto);
//			System.out.println(dtoOrder);
////			List<ItemVoucherDto> itemVouchers = voucherCrocsService.getListCodeObject(searchDto);
//
//			ImportExportExcelXLSX.exportVoucherCrocs(list, response.getOutputStream(), ip, dtoOrder);
//			response.setContentType("application/vnd.ms-excel");
//			response.setHeader("Content-Disposition", "attachment; filename=THONG_KE.xlsx");
//			response.flushBuffer();
//			
//			
////			List<ItemVoucherDto> itemVouchers = voucherCrocsService.getListCodeObject(searchDto);
////
////			ImportExportExcelXLSX.exportItemVouchers(itemVouchers, response.getOutputStream(), ip);
////			response.setContentType("application/vnd.ms-excel");
////			response.setHeader("Content-Disposition", "attachment; filename=SO_LUONG.xlsx");
////			response.flushBuffer();
//
//		} catch (FileNotFoundException e) {
//			// TODO Auto-generated catch block
//			e.printStackTrace();
//		} catch (IOException e) {
//			// TODO Auto-generated catch block
//			e.printStackTrace();
//		}
//	}
	
//	@RequestMapping(value = "/export_quantity/", method = { RequestMethod.POST })
//	public void exportQuantityItem(WebRequest request, HttpServletResponse response, @RequestBody VoucherCrocsDto searchDto) {
//		try {
//			Resource resource = resourceLoader.getResource("classpath:SO_LUONG.xlsx");
//			InputStream ip = resource.getInputStream(); // <-- Lấy file trong resource đưa về dạng InputStream
//
//			List<ItemVoucherDto> itemVouchers = voucherCrocsService.getListCodeObject(searchDto);
//
//			ImportExportExcelXLSX.exportItemVouchers(itemVouchers, response.getOutputStream(), ip);
//			response.setContentType("application/vnd.ms-excel");
//			response.setHeader("Content-Disposition", "attachment; filename=SO_LUONG.xlsx");
//			response.flushBuffer();
//
//		} catch (FileNotFoundException e) {
//			// TODO Auto-generated catch block
//			e.printStackTrace();
//		} catch (IOException e) {
//			// TODO Auto-generated catch block
//			e.printStackTrace();
//		}
//	}
	
	@RequestMapping(value = "/export_body/", method = { RequestMethod.POST })
	public void exportQuantityItem(WebRequest request, HttpServletResponse response, @RequestBody BodyDto searchDto) {
		try {
			Resource resource = resourceLoader.getResource("classpath:BODY.xlsx");
			InputStream ip = resource.getInputStream(); // <-- Lấy file trong resource đưa về dạng InputStream

			List<BodyDto> itemVouchers = bodyService.getRandomAllObject();

			ImportExportExcelXLSX.exportBody(itemVouchers, response.getOutputStream(), ip);
			response.setContentType("application/vnd.ms-excel");
			response.setHeader("Content-Disposition", "attachment; filename=SO_LUONG.xlsx");
			response.flushBuffer();

		} catch (FileNotFoundException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}
	
//	@RequestMapping(value = "/export_delivery/", method = { RequestMethod.POST })
//	public void exportDelivery(WebRequest request, HttpServletResponse response, @RequestBody VoucherCrocsDto searchDto) {
//		try {
//			Resource resource = resourceLoader.getResource("classpath:GHTK.xlsx");
//			InputStream ip = resource.getInputStream(); // <-- Lấy file trong resource đưa về dạng InputStream
//
//			List<VoucherCrocsDto> list = voucherCrocsService.getListObject(searchDto);
//			
//
//			ImportExportExcelXLSX.exportVoucherCrocsDelivery(list, response.getOutputStream(), ip);
//			response.setContentType("application/vnd.ms-excel");
//			response.setHeader("Content-Disposition", "attachment; filename=GHTK.xlsx");
//			response.flushBuffer();
//			
//
//		} catch (FileNotFoundException e) {
//			// TODO Auto-generated catch block
//			e.printStackTrace();
//		} catch (IOException e) {
//			// TODO Auto-generated catch block
//			e.printStackTrace();
//		}
//	}
	
//	@RequestMapping(value = "/export_quantity/", method = { RequestMethod.POST })
//	public void exportQuantityItem(WebRequest request, HttpServletResponse response, @RequestBody VoucherCrocsDto searchDto) {
//		try {
//			Resource resource = resourceLoader.getResource("classpath:GHN.xlsx");
//			InputStream ip = resource.getInputStream(); // <-- Lấy file trong resource đưa về dạng InputStream
//
//			List<VoucherCrocsDto> list = voucherCrocsService.getListObject(searchDto);
//			
//
//			ImportExportExcelXLSX.exportVoucherCrocsDeliveryFast(list, response.getOutputStream(), ip);
//			response.setContentType("application/vnd.ms-excel");
//			response.setHeader("Content-Disposition", "attachment; filename=GHTK.xlsx");
//			response.flushBuffer();
//			
//
//		} catch (FileNotFoundException e) {
//			// TODO Auto-generated catch block
//			e.printStackTrace();
//		} catch (IOException e) {
//			// TODO Auto-generated catch block
//			e.printStackTrace();
//		}
//	}
	
}
