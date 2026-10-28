import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionAttribute;
import org.springframework.security.oauth2.provider.OAuth2Authentication;
import org.springframework.security.oauth2.provider.TokenRequest;
import org.springframework.security.oauth2.common.exceptions.InvalidGrantException;
import org.springframework.security.oauth2.common.exceptions.InvalidTokenException;
import com.globits.security.ValidatingTokenServices;
public class TokenTransactionProbe {
 public static void main(String[] args) throws Exception {
  AnnotationTransactionAttributeSource source=new AnnotationTransactionAttributeSource();
  for(String name:new String[]{"createAccessToken","refreshAccessToken","loadAuthentication","revokeToken","revokeForClient"}) {
   java.lang.reflect.Method method=null;
   for(java.lang.reflect.Method candidate:ValidatingTokenServices.class.getMethods())if(candidate.getName().equals(name)){method=candidate;break;}
   TransactionAttribute attribute=source.getTransactionAttribute(method,ValidatingTokenServices.class);
   System.out.println(name+"="+attribute+(attribute==null?"":" rollbackInvalidGrant="+attribute.rollbackOn(new InvalidGrantException("dummy"))+" rollbackInvalidToken="+attribute.rollbackOn(new InvalidTokenException("dummy"))));
  }
 }
}